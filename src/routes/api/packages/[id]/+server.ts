import { query } from '$lib/db';

// --- tiny YAML-ish parser for Rails :payment_installments_per_date ---
// Accepts the serialized hash and returns [{ date: 'YYYY-MM-DD', sum: number, invoice_no?: string }]
function parseInstallments(text: string | null | undefined) {
	if (!text) return [] as { date: string; sum: number; invoice_no?: string }[];

	// Matches:
	// '2024-02-01':
	//   :date: 2024-02-01
	//   :sum: 1234.56
	//   :invoice_no: ''
	const rx =
		/['"]?(\d{4}-\d{2}-\d{2})['"]?\s*:\s*\n(?:.*\n)*?\s*:sum:\s*([0-9.,]+)(?:\s*\n\s*:invoice_no:\s*['"]?([^'"]*)['"]?)?/g;
	const out: { date: string; sum: number; invoice_no?: string }[] = [];
	let m: RegExpExecArray | null;
	while ((m = rx.exec(text))) {
		const [, date, sumStr, invoiceNo] = m;
		out.push({
			date,
			sum: parseFloat(sumStr.replace(',', '.')) || 0,
			invoice_no: invoiceNo ?? ''
		});
	}
	// sort by date ascending
	out.sort((a, b) => a.date.localeCompare(b.date));
	return out;
}

function endOfMonth(d: Date) {
	return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export async function GET({ params }) {
	const id = Number(params.id);
	if (isNaN(id)) return new Response('Invalid ID', { status: 400 });

	// Base package info
	const sql = `
		SELECT 
			p.id,
			p.created_at,
			p.paid_price,
			p.first_payment_date,
			p.autogiro,
			p.invoice_numbers,
			p.payment_installments_per_date,
			p.frozen_from_date,
			a.id AS article_id,
			a.name AS article_name,
			a.sessions AS article_sessions,
			a.validity_end_date AS article_validity_end_date,
			cu.id AS customer_id,
			cu.name AS customer_name,
			cl.id AS client_id,
			cl.firstname AS client_firstname,
			cl.lastname AS client_lastname
		FROM packages p
		JOIN articles a ON p.article_id = a.id
		JOIN customers cu ON p.customer_id = cu.id
		LEFT JOIN clients cl ON p.client_id = cl.id
		WHERE p.id = $1
	`;
	const result = await query(sql, [id]);
	if (!result.length) return new Response('Not found', { status: 404 });

	const row = result[0];

	const usedSql = `
  SELECT COUNT(*)::int AS used
  FROM bookings
  WHERE package_id = $1
    AND (status IS NULL OR status NOT IN ('Cancelled','Canceled'))
`;
	const usedRes = await query(usedSql, [id]);
	const used_sessions: number = usedRes[0]?.used ?? 0;

	const total_sessions: number = Number(row.article_sessions ?? 0);
	const remaining_sessions = Math.max(0, total_sessions - used_sessions);

	// Parse installments
	const installments = parseInstallments(row.payment_installments_per_date);

	const installments_count = installments.length;
	const installments_total = installments.reduce((acc, i) => acc + (i.sum || 0), 0);
	const first_installment_date = installments[0]?.date ?? null;
	const last_installment_date = installments[installments.length - 1]?.date ?? null;

	// Freeze CTA rules (old site logic):
	// not frozen yet AND has future installments AND remaining sessions > 0
	const today = new Date();
	const lastDateObj = last_installment_date ? new Date(last_installment_date) : null;
	const freeze_allowed =
		!row.frozen_from_date &&
		installments_count > 0 &&
		lastDateObj !== null &&
		lastDateObj > today &&
		remaining_sessions > 0;

	// Locked installments = installments with month-end < this month-end (can’t change unless admin)
	const monthEndNow = endOfMonth(today);
	const locked_installments = installments.filter(
		(i) => endOfMonth(new Date(i.date)) < monthEndNow
	).length;

	const price_per_session =
		total_sessions > 0 && row.paid_price != null ? Number(row.paid_price) / total_sessions : null;

	const passes_per_payment =
		installments_count > 0 ? Number(total_sessions) / Number(installments_count) : null;

	const overbooked = used_sessions > total_sessions;

	// Valid to … (old show page used created_at + 1 year)
	const valid_to = row.created_at
		? new Date(new Date(row.created_at).setFullYear(new Date(row.created_at).getFullYear() + 1))
		: null;

	return new Response(
		JSON.stringify({
			id: row.id,
			created_at: row.created_at,
			paid_price: row.paid_price,
			first_payment_date: row.first_payment_date,
			autogiro: row.autogiro,
			invoice_numbers: row.invoice_numbers ?? [],
			frozen_from_date: row.frozen_from_date,
			client: row.client_id
				? {
						id: row.client_id,
						firstname: row.client_firstname,
						lastname: row.client_lastname
					}
				: null,
			customer: {
				id: row.customer_id,
				name: row.customer_name
			},
			article: {
				id: row.article_id,
				name: row.article_name,
				sessions: total_sessions,
				validity_end_date: row.article_validity_end_date // (kept if you want to use it elsewhere)
			},

			// New computed fields
			used_sessions,
			remaining_sessions,
			price_per_session,
			passes_per_payment,
			valid_to: valid_to ? valid_to.toISOString().slice(0, 10) : null,

			installments,
			installments_summary: {
				count: installments_count,
				first_date: first_installment_date,
				last_date: last_installment_date,
				total_sum: Math.round(installments_total * 100) / 100
			},

			freeze: {
				allowed: !!freeze_allowed,
				from_date: row.frozen_from_date
			},
			locked_installments,
			overbooked
		}),
		{ status: 200 }
	);
}

export async function DELETE({ params }) {
	const id = Number(params.id);
	if (Number.isNaN(id))
		return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });

	// Prevent delete if there are chargeable bookings (same semantics as old app)
	const [{ cnt }] = await query(
		`SELECT COUNT(*)::int AS cnt
     FROM bookings
     WHERE package_id = $1
       AND (status IS NULL OR status NOT IN ('Cancelled','Canceled'))`,
		[id]
	);

	if (cnt > 0) {
		return new Response(
			JSON.stringify({ error: 'Paketet har bokningar och kunde inte tas bort' }),
			{
				status: 400
			}
		);
	}

	// detach any remaining bookings (if any)
	await query(`UPDATE bookings SET package_id = NULL WHERE package_id = $1`, [id]);
	await query(`DELETE FROM packages WHERE id = $1`, [id]);

	return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
