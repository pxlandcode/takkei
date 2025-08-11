// src/routes/api/reports/customer-credit-balance/+server.ts
import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

type Row = {
	package_id: number;
	sessions: number | null;
	product_name: string;
	article_price: string | number | null;
	paid_price: string | number | null;
	invoice_numbers: number[] | null;
	installments_text: string | null;
	customer_name: string;
	customer_no: string | null;
	client_name: string | null;
	invoice_count: number;
	used_total: number;
	used_month: number;
};

function toNumber(n: unknown, def = 0) {
	const num = typeof n === 'string' ? Number(n) : (n as number);
	return Number.isFinite(num) ? (num as number) : def;
}

// Parse YAML-or-JSON of the form:
// ---\nYYYY-MM-DD:\n  sum: 1000\nYYYY-MM-DD:\n  sum: 800\n
// or {"2024-06-01":{"sum":1000}, ...}
function parseInstallments(text: string | null): Record<string, { sum: number }> {
	if (!text || !text.trim()) return {};
	const t = text.trim();

	// Try JSON first
	try {
		const obj = JSON.parse(t);
		const out: Record<string, { sum: number }> = {};
		for (const k of Object.keys(obj ?? {})) {
			const v = obj[k];
			const sum = typeof v?.sum === 'number' ? v.sum : Number(v?.sum ?? 0);
			out[k] = { sum: Number.isFinite(sum) ? sum : 0 };
		}
		return out;
	} catch {
		// Fall through to a tiny YAML-ish parser
	}

	// Extremely small YAML reader for the known shape: date keys + nested "sum:"
	// It tolerates leading '---' and blank lines.
	const out: Record<string, { sum: number }> = {};
	const lines = t.split(/\r?\n/);
	let currentDate: string | null = null;

	for (const raw of lines) {
		const line = raw.trim();
		if (!line || line === '---') continue;

		// A date key like "2024-06-01:" or "2024-6-1:"
		const keyMatch = line.match(/^(\d{4}-\d{1,2}-\d{1,2})\s*:\s*$/);
		if (keyMatch) {
			currentDate = keyMatch[1];
			if (!out[currentDate]) out[currentDate] = { sum: 0 };
			continue;
		}

		// Inline key-value "2024-06-01: { sum: 1000 }"
		const inlineMatch = line.match(
			/^(\d{4}-\d{1,2}-\d{1,2})\s*:\s*\{?\s*sum\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*\}?\s*$/i
		);
		if (inlineMatch) {
			out[inlineMatch[1]] = { sum: Number(inlineMatch[2]) };
			currentDate = null;
			continue;
		}

		// Nested value line like "sum: 1000"
		if (currentDate) {
			const sumMatch = line.match(/^sum\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*$/i);
			if (sumMatch) {
				out[currentDate].sum = Number(sumMatch[1]);
				continue;
			}
		}
	}

	return out;
}

export const GET = async ({ url }) => {
	const start_date = url.searchParams.get('start_date'); // YYYY-MM-01
	const end_date = url.searchParams.get('end_date'); // YYYY-MM-DD

	if (!start_date || !end_date) {
		return json({ error: 'Missing start_date or end_date' }, { status: 400 });
	}

	// Keep timezone handling inside Postgres (no AT TIME ZONE).
	const sql = `
WITH base AS (
  SELECT
    p.id                                        AS package_id,
    a.sessions                                  AS sessions,
    a.name                                      AS product_name,
    a.price                                     AS article_price,
    p.paid_price                                AS paid_price,
    p.invoice_numbers                            AS invoice_numbers,
    p.payment_installments_per_date             AS installments_text,
    cu.name                                     AS customer_name,
    cu.customer_no                              AS customer_no,
    (cl.firstname || ' ' || cl.lastname)        AS client_name
  FROM packages p
  JOIN articles a   ON a.id = p.article_id
  JOIN customers cu ON cu.id = p.customer_id
  LEFT JOIN clients cl ON cl.id = p.client_id
),
usage AS (
  SELECT
    p.id AS package_id,
    COUNT(*) FILTER (
      WHERE b.start_time <= ($2::date + interval '1 day' - interval '1 second')
    )::int AS used_total,
    COUNT(*) FILTER (
      WHERE b.start_time >= $1::timestamp
        AND b.start_time <= ($2::date + interval '1 day' - interval '1 second')
    )::int AS used_month
  FROM packages p
  LEFT JOIN bookings b
    ON b.package_id = p.id
   AND COALESCE(b.try_out, false) = false
   AND COALESCE(b.actual_cancel_time, b.cancel_time) IS NULL
   AND (b.status IS NULL OR b.status NOT IN ('Cancelled','Canceled','CancelledByUser'))
  GROUP BY p.id
)
SELECT
  b.package_id,
  b.sessions,
  b.product_name,
  b.article_price,
  b.paid_price,
  b.invoice_numbers,
  b.installments_text,
  b.customer_name,
  b.customer_no,
  b.client_name,
  CARDINALITY(COALESCE(b.invoice_numbers, ARRAY[]::int[]))::int AS invoice_count,
  COALESCE(u.used_total, 0)  AS used_total,
  COALESCE(u.used_month, 0)  AS used_month
FROM base b
LEFT JOIN usage u ON u.package_id = b.package_id
ORDER BY b.customer_name, b.client_name NULLS LAST, b.package_id;
`;

	const rows: Row[] = await query(sql, [start_date, end_date]);

	// Post-process to compute payments & amounts like the old Ruby did
	const data = rows.map((r) => {
		const sessions = toNumber(r.sessions);
		const articlePrice = toNumber(r.article_price);
		const paidPrice = toNumber(r.paid_price);
		const invoiceNumbers = (r.invoice_numbers ?? []).map(String);

		// Prefer paid_price for price per session; fall back to article price
		const basePrice = paidPrice || articlePrice || 0;
		const pps = sessions > 0 ? basePrice / sessions : 0;

		// Parse installments (YAML or JSON) and sum up to end_date
		const installments = parseInstallments(r.installments_text);
		const allDates = Object.keys(installments).sort();
		let number_of_payments2 = 0;
		let paid_sum2 = 0;

		for (const d of allDates) {
			// tolerate YYYY-M-D
			const safe = d.length === 10 ? d : new Date(d).toISOString().slice(0, 10);
			if (safe <= end_date) {
				number_of_payments2 += 1;
				paid_sum2 += toNumber(installments[d]?.sum);
			} else {
				break;
			}
		}

		const paidSessions = pps === 0 ? 0 : paid_sum2 / pps;
		const used_total = toNumber(r.used_total);
		const used_month = toNumber(r.used_month);
		const remaining = Math.max(sessions - used_total, 0);

		const used_sum = used_total * pps;
		const used_sum_month = used_month * pps;
		const balance = paid_sum2 - used_sum;
		const scheduled_count = allDates.length;

		return {
			client: r.client_name ?? '',
			packageId: r.package_id,
			invoiceNumbers,
			customerName: r.customer_name,
			customerNo: r.customer_no,
			product: r.product_name,
			packagePrice: paidPrice, // number
			sessions, // number
			pricePerSession: Number(pps.toFixed(2)), // number
			invoiceCount: scheduled_count,
			invoicesUntilEnd: number_of_payments2, // unchanged
			paidSessions: Number(paidSessions.toFixed(2)),
			paidSum: Number(paid_sum2.toFixed(2)),
			usedSessions: used_total,
			usedSessionsMonth: used_month,
			remainingSessions: remaining,
			usedSum: Number(used_sum.toFixed(2)),
			usedSumMonth: Number(used_sum_month.toFixed(2)),
			balance: Number(balance.toFixed(2))
		};
	});

	return json({ rows: data });
};
