import { query } from '$lib/db';

type DbRow = {
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
	const v = typeof n === 'string' ? Number(n) : (n as number);
	return Number.isFinite(v) ? (v as number) : def;
}

// Accept both YAML and JSON (same parser we used before)
function parseInstallments(text: string | null): Record<string, { sum: number }> {
	if (!text || !text.trim()) return {};
	const t = text.trim();

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
		/* fall through */
	}

	const out: Record<string, { sum: number }> = {};
	const lines = t.split(/\r?\n/);
	let current: string | null = null;
	for (const raw of lines) {
		const line = raw.trim();
		if (!line || line === '---') continue;
		const m1 = line.match(/^(\d{4}-\d{1,2}-\d{1,2})\s*:\s*$/);
		if (m1) {
			current = m1[1];
			if (!out[current]) out[current] = { sum: 0 };
			continue;
		}
		const m2 = line.match(
			/^(\d{4}-\d{1,2}-\d{1,2})\s*:\s*\{?\s*sum\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*\}?\s*$/i
		);
		if (m2) {
			out[m2[1]] = { sum: Number(m2[2]) };
			current = null;
			continue;
		}
		if (current) {
			const m3 = line.match(/^sum\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*$/i);
			if (m3) out[current].sum = Number(m3[1]);
		}
	}
	return out;
}

export type ReportRow = {
	client: string;
	packageId: number;
	invoiceNumbers: string[];
	customerName: string;
	customerNo?: string | null;
	product: string;
	packagePrice: number;
	sessions: number;
	pricePerSession: number;
	invoiceCount: number;
	invoicesUntilEnd: number;
	paidSessions: number;
	paidSum: number;
	usedSessions: number;
	usedSessionsMonth: number;
	remainingSessions: number;
	usedSum: number;
	usedSumMonth: number;
	balance: number;
};

export async function getCustomerCreditRows(
	start_date: string,
	end_date: string
): Promise<ReportRow[]> {
	const sql = `
WITH base AS (
  SELECT p.id AS package_id, a.sessions, a.name AS product_name, a.price AS article_price,
         p.paid_price, p.invoice_numbers, p.payment_installments_per_date AS installments_text,
         cu.name AS customer_name, cu.customer_no,
         (cl.firstname || ' ' || cl.lastname) AS client_name
  FROM packages p
  JOIN articles a   ON a.id = p.article_id
  JOIN customers cu ON cu.id = p.customer_id
  LEFT JOIN clients cl ON cl.id = p.client_id
),
usage AS (
  SELECT p.id AS package_id,
         COUNT(*) FILTER (WHERE b.start_time <= ($2::date + interval '1 day' - interval '1 second'))::int AS used_total,
         COUNT(*) FILTER (WHERE b.start_time >= $1::timestamp
                          AND b.start_time <= ($2::date + interval '1 day' - interval '1 second'))::int AS used_month
  FROM packages p
  LEFT JOIN bookings b ON b.package_id = p.id
    AND COALESCE(b.try_out, false) = false
    AND COALESCE(b.actual_cancel_time, b.cancel_time) IS NULL
    AND (b.status IS NULL OR b.status NOT IN ('Cancelled','Canceled','CancelledByUser'))
  GROUP BY p.id
)
SELECT b.package_id, b.sessions, b.product_name, b.article_price, b.paid_price,
       b.invoice_numbers, b.installments_text, b.customer_name, b.customer_no, b.client_name,
       CARDINALITY(COALESCE(b.invoice_numbers, ARRAY[]::int[]))::int AS invoice_count,
       COALESCE(u.used_total,0) AS used_total, COALESCE(u.used_month,0) AS used_month
FROM base b
LEFT JOIN usage u ON u.package_id = b.package_id
ORDER BY b.customer_name, b.client_name NULLS LAST, b.package_id;`;

	const rows = (await query(sql, [start_date, end_date])) as DbRow[];

	return rows.map((r) => {
		const sessions = toNumber(r.sessions);
		const articlePrice = toNumber(r.article_price);
		const paidPrice = toNumber(r.paid_price);
		const invoiceNumbers = (r.invoice_numbers ?? []).map(String);
		const basePrice = paidPrice || articlePrice || 0;
		const pps = sessions > 0 ? basePrice / sessions : 0;

		const installments = parseInstallments(r.installments_text);
		const keys = Object.keys(installments).sort();
		let invoicesUntilEnd = 0;
		let paidSum = 0;
		for (const k of keys) {
			const safe = k.length === 10 ? k : new Date(k).toISOString().slice(0, 10);
			if (safe <= end_date) {
				invoicesUntilEnd += 1;
				paidSum += toNumber(installments[k]?.sum);
			} else break;
		}
		const invoiceCount = keys.length;
		const usedTotal = toNumber(r.used_total);
		const usedMonth = toNumber(r.used_month);
		const remaining = Math.max(sessions - usedTotal, 0);
		const usedSum = usedTotal * pps;
		const usedSumMonth = usedMonth * pps;
		const paidSessions = pps === 0 ? 0 : paidSum / pps;
		const balance = paidSum - usedSum;

		return {
			client: r.client_name ?? '',
			packageId: r.package_id,
			invoiceNumbers,
			customerName: r.customer_name,
			customerNo: r.customer_no,
			product: r.product_name,
			packagePrice: paidPrice,
			sessions,
			pricePerSession: Math.round(pps * 100) / 100,
			invoiceCount,
			invoicesUntilEnd,
			paidSessions: Math.round(paidSessions * 100) / 100,
			paidSum: Math.round(paidSum * 100) / 100,
			usedSessions: usedTotal,
			usedSessionsMonth: usedMonth,
			remainingSessions: remaining,
			usedSum: Math.round(usedSum * 100) / 100,
			usedSumMonth: Math.round(usedSumMonth * 100) / 100,
			balance: Math.round(balance * 100) / 100
		};
	});
}
