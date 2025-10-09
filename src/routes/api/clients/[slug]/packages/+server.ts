import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function GET({ params }) {
	const clientId = Number(params.slug);
	if (!Number.isInteger(clientId)) {
		return json({ error: 'Invalid client id' }, { status: 400 });
	}

	try {
		const relationshipRows = await query(
			`SELECT customer_id
			 FROM client_customer_relationships
			 WHERE client_id = $1
			   AND active = TRUE`,
			[clientId]
		);

		const customerIds = Array.from(
			new Set(
				relationshipRows
					.map((row: any) => row.customer_id)
					.filter((id: number | null) => typeof id === 'number')
			)
		);

		const paramsList: any[] = [clientId];
		let sharedClause = '';
		if (customerIds.length) {
			paramsList.push(customerIds);
			sharedClause = ` OR (p.client_id IS NULL AND p.customer_id = ANY($2::int[]))`;
		}

		const rawPackages = await query(
			`SELECT
				p.id,
				p.customer_id,
				p.client_id,
				p.autogiro,
				p.frozen_from_date,
				p.invoice_numbers,
				p.article_id,
				p.first_payment_date,
				p.created_at,
				a.name AS article_name,
				a.sessions AS article_sessions,
				cu.name AS customer_name
			FROM packages p
			JOIN customers cu ON cu.id = p.customer_id
			LEFT JOIN articles a ON a.id = p.article_id
			WHERE p.client_id = $1${sharedClause}
			ORDER BY COALESCE(p.first_payment_date, p.created_at), p.id`,
			paramsList
		);

		if (!rawPackages.length) {
			return json([]);
		}

		const ids = rawPackages.map((row: any) => row.id);
		const bookingCountsRows = await query(
			`SELECT
				package_id,
				COUNT(*)::int AS total_cnt,
				SUM(CASE WHEN start_time < NOW() THEN 1 ELSE 0 END)::int AS used_until_now
			FROM bookings
			WHERE package_id = ANY($1::int[])
				AND (status IS NULL OR LOWER(status) <> 'cancelled')
			GROUP BY package_id`,
			[ids]
		);

		const bookingCounts = bookingCountsRows.reduce(
			(acc: Record<number, { total: number; usedUntilNow: number }>, row: any) => {
				acc[row.package_id] = {
					total: row.total_cnt ?? 0,
					usedUntilNow: row.used_until_now ?? 0
				};
				return acc;
			},
			{}
		);

		const packages = rawPackages.map((row: any) => {
			const sessions =
				row.article_sessions === null || row.article_sessions === undefined
					? null
					: Number(row.article_sessions);
			const counts = bookingCounts[row.id] ?? { total: 0, usedUntilNow: 0 };
			const usedTotal = counts.total;
			const usedUntilNow = counts.usedUntilNow;
			const remaining = sessions != null ? Math.max(0, sessions - usedTotal) : null;
			const remainingToday = sessions != null ? Math.max(0, sessions - usedUntilNow) : null;

			const frozenDate = row.frozen_from_date ? new Date(row.frozen_from_date).toISOString() : null;
			const firstPaymentDate = row.first_payment_date
				? new Date(row.first_payment_date).toISOString()
				: null;

			return {
				id: row.id,
				article: {
					id: row.article_id,
					name: row.article_name ?? 'Okänt paket'
				},
				customer: {
					id: row.customer_id,
					name: row.customer_name ?? 'Okänd kund'
				},
				is_personal: row.client_id === clientId,
				autogiro: !!row.autogiro,
				frozen_from_date: frozenDate,
				invoice_numbers: Array.isArray(row.invoice_numbers) ? row.invoice_numbers : [],
				first_payment_date: firstPaymentDate,
				remaining_sessions_today: remainingToday,
				remaining_sessions: remaining,
				used_sessions_total: usedTotal,
				used_sessions_until_now: usedUntilNow,
				total_sessions: sessions,
				is_active: remainingToday != null ? remainingToday > 0 : false
			};
		});

		return json(packages);
	} catch (error) {
		console.error('Error fetching client packages:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
