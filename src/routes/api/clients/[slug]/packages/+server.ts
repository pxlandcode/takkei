import { json, type RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import {
	chargeablePackageBookingSql,
	getNextStockholmDayStartLocal,
	getStockholmYmd,
	selectActivePackage,
	trainingRelationshipSql
} from '$lib/server/packageSemantics';

type RawPackageRow = {
	id: number;
	customer_id: number;
	client_id: number | null;
	autogiro: boolean | null;
	frozen_from_date: string | null;
	invoice_numbers: (string | number)[] | null;
	article_id: number | null;
	first_payment_date: string | null;
	created_at: string | null;
	article_name: string | null;
	article_sessions: number | null;
	article_validity_start_date: string | null;
	article_validity_end_date: string | null;
	customer_name: string | null;
};

function ymd(value: unknown) {
	if (typeof value !== 'string') return null;
	const match = value.match(/\d{4}-\d{2}-\d{2}/);
	return match ? match[0] : null;
}

function compareByFirstPaymentDate(a: RawPackageRow, b: RawPackageRow) {
	const aDate = ymd(a.first_payment_date);
	const bDate = ymd(b.first_payment_date);

	if (aDate && bDate) {
		const cmp = aDate.localeCompare(bDate);
		if (cmp !== 0) return cmp;
	} else if (!aDate && bDate) {
		return 1;
	} else if (aDate && !bDate) {
		return -1;
	}

	return Number(a.id) - Number(b.id);
}

export const GET: RequestHandler = async ({ params, url }) => {
	const clientId = Number(params.slug);
	if (!Number.isInteger(clientId)) {
		return json({ error: 'Invalid client id' }, { status: 400 });
	}

	try {
		const selectedYmd = ymd(url.searchParams.get('date')) ?? getStockholmYmd(new Date());
		const eligibleOnly = ['1', 'true', 'yes'].includes(
			(url.searchParams.get('eligibleOnly') ?? '').toLowerCase()
		);
		const nextDayStartLocal = selectedYmd ? getNextStockholmDayStartLocal(selectedYmd) : null;
		if (!selectedYmd || !nextDayStartLocal) {
			return json({ error: 'Failed to determine business date' }, { status: 500 });
		}

		const personalPackages = (await query(
			`
			SELECT
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
				a.validity_start_date AS article_validity_start_date,
				a.validity_end_date AS article_validity_end_date,
				cu.name AS customer_name
			FROM packages p
			JOIN customers cu ON cu.id = p.customer_id
			LEFT JOIN articles a ON a.id = p.article_id
			WHERE p.client_id = $1
				AND (
					$3::boolean = FALSE
					OR (
						(p.frozen_from_date IS NULL OR p.frozen_from_date > $2::date)
						AND (a.validity_start_date IS NULL OR a.validity_start_date <= $2::date)
						AND (a.validity_end_date IS NULL OR a.validity_end_date >= $2::date)
					)
				)
			`,
			[clientId, selectedYmd, eligibleOnly]
		)) as RawPackageRow[];

		const sharedPackages = (await query(
			`
			SELECT
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
				a.validity_start_date AS article_validity_start_date,
				a.validity_end_date AS article_validity_end_date,
				cu.name AS customer_name
			FROM packages p
			JOIN customers cu ON cu.id = p.customer_id
			LEFT JOIN articles a ON a.id = p.article_id
			WHERE p.client_id IS NULL
				AND EXISTS (
					SELECT 1
					FROM client_customer_relationships ccr
					WHERE ccr.client_id = $1
						AND ccr.customer_id = p.customer_id
						AND ${trainingRelationshipSql('ccr')}
				)
				AND (p.frozen_from_date IS NULL OR p.frozen_from_date > $2::date)
				AND (a.validity_start_date IS NULL OR a.validity_start_date <= $2::date)
				AND (a.validity_end_date IS NULL OR a.validity_end_date >= $2::date)
			`,
			[clientId, selectedYmd]
		)) as RawPackageRow[];

		const rawPackages = [...personalPackages, ...sharedPackages].sort(compareByFirstPaymentDate);
		if (!rawPackages.length) {
			return json([]);
		}

		const packageIds = rawPackages.map((row) => Number(row.id));
		const bookingCountsRows = await query(
			`
			SELECT
				b.package_id,
				COUNT(*)::int AS total_cnt,
				(COUNT(*) FILTER (WHERE b.start_time < $2))::int AS used_until_today_cnt
			FROM bookings b
			WHERE b.package_id = ANY($1::int[])
				AND ${chargeablePackageBookingSql('b')}
			GROUP BY b.package_id
			`,
			[packageIds, nextDayStartLocal]
		);

		const bookingCounts = bookingCountsRows.reduce(
			(acc: Record<number, { total: number; usedUntilToday: number }>, row: any) => {
				acc[Number(row.package_id)] = {
					total: Number(row.total_cnt ?? 0),
					usedUntilToday: Number(row.used_until_today_cnt ?? 0)
				};
				return acc;
			},
			{}
		);

		const sharedCustomerIds = Array.from(
			new Set(
				rawPackages
					.filter((row) => row.client_id == null)
					.map((row) => Number(row.customer_id))
					.filter((id) => Number.isInteger(id))
			)
		);

		let sharedClientCounts: Record<number, number> = {};
		if (sharedCustomerIds.length) {
			const rows = await query(
				`
				SELECT ccr.customer_id, COUNT(DISTINCT ccr.client_id)::int AS training_client_count
				FROM client_customer_relationships ccr
				WHERE ccr.customer_id = ANY($1::int[])
					AND ${trainingRelationshipSql('ccr')}
				GROUP BY ccr.customer_id
				`,
				[sharedCustomerIds]
			);

			sharedClientCounts = rows.reduce((acc: Record<number, number>, row: any) => {
				acc[Number(row.customer_id)] = Number(row.training_client_count ?? 0);
				return acc;
			}, {});
		}

		const mapped = rawPackages.map((row) => {
			const sessions =
				row.article_sessions === null || row.article_sessions === undefined
					? null
					: Number(row.article_sessions);
			const counts = bookingCounts[Number(row.id)] ?? { total: 0, usedUntilToday: 0 };
			const remaining =
				sessions === null || Number.isNaN(sessions) ? null : sessions - counts.total;
			const remainingToday =
				sessions === null || Number.isNaN(sessions) ? null : sessions - counts.usedUntilToday;
			const isPersonal = row.client_id === clientId;
			const trainingClientCount =
				row.client_id == null ? (sharedClientCounts[Number(row.customer_id)] ?? 0) : 0;

			return {
				id: Number(row.id),
				article: {
					id: row.article_id,
					name: row.article_name ?? 'Okänt paket'
				},
				customer: {
					id: Number(row.customer_id),
					name: row.customer_name ?? 'Okänd kund'
				},
				is_personal: isPersonal,
				is_shared: !isPersonal,
				autogiro: !!row.autogiro,
				frozen_from_date: ymd(row.frozen_from_date),
				invoice_numbers: Array.isArray(row.invoice_numbers) ? row.invoice_numbers : [],
				first_payment_date: ymd(row.first_payment_date),
				remaining_sessions_today: remainingToday,
				remaining_sessions: remaining,
				used_sessions_total: counts.total,
				used_sessions_until_today: counts.usedUntilToday,
				used_sessions_until_now: counts.usedUntilToday,
				total_sessions: sessions,
				shared_warning: row.client_id == null && trainingClientCount > 1,
				shared_training_client_count: trainingClientCount,
				// internal fields used only for active selection
				article_validity_start_date: ymd(row.article_validity_start_date),
				article_validity_end_date: ymd(row.article_validity_end_date)
			};
		});

		const active = selectActivePackage(
			mapped.map((pkg) => ({
				id: pkg.id,
				is_personal: pkg.is_personal,
				is_shared: pkg.is_shared,
				remaining_sessions: pkg.remaining_sessions,
				first_payment_date: pkg.first_payment_date,
				frozen_from_date: pkg.frozen_from_date,
				validity_start_date: pkg.article_validity_start_date,
				validity_end_date: pkg.article_validity_end_date
			})),
			selectedYmd
		);

		const activeId = active?.id ?? null;
		const response = mapped.map((pkg) => {
			const out: any = { ...pkg, is_active: pkg.id === activeId };
			delete out.article_validity_start_date;
			delete out.article_validity_end_date;
			return out;
		});

		return json(response);
	} catch (error) {
		console.error('Error fetching client packages:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
