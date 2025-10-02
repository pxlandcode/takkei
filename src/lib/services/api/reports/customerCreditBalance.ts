import { query } from '$lib/db';

type DbRow = {
	package_id: number;
	customer_id: number;
	sessions: number | null;
	product_name: string;
	article_price: string | number | null;
	paid_price: string | number | null;
	invoice_numbers: number[] | null;
	installments_text: string | null;
	customer_name: string;
	customer_no: string | null;
	client_name: string | null;
	fallback_client_name: string | null;
	first_payment_date: string | null;
	invoice_count: number;
	used_total: number;
	used_month: number;
	chargeable_total: number;
	last_used_at: string | null;
};

function toNumber(n: unknown, def = 0) {
	const v = typeof n === 'string' ? Number(n) : (n as number);
	return Number.isFinite(v) ? (v as number) : def;
}

// Accept both YAML and JSON (same parser we used before)

function normalizeDateKey(raw: string) {
	const leadingTrimmed = raw.replace(/^['"]/, '').trim();
	return leadingTrimmed.replace(/['"](?=\s*:\s*)/, '').replace(/['"]$/, '');
}

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
		const normalized = normalizeDateKey(line);
		const m1 = normalized.match(/^(\d{4}-\d{1,2}-\d{1,2})\s*:\s*$/);
		if (m1) {
			current = m1[1];
			if (!out[current]) out[current] = { sum: 0 };
			continue;
		}
		const m2 = normalized.match(
			/^(\d{4}-\d{1,2}-\d{1,2})\s*:\s*\{?\s*:?(?:sum)\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*\}?\s*$/i
		);
		if (m2) {
			out[m2[1]] = { sum: Number(m2[2]) };
			current = null;
			continue;
		}
		if (current) {
			const m3 = normalized.match(/^:?(?:sum)\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*$/i);
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

export type CustomerCreditReportFilters = {
	startDate: string;
	endDate: string;
	includeZeroBalances?: boolean;
};

type CustomerCreditReport = {
	rows: ReportRow[];
	totalBalance: number;
	rawRows: ReportRow[];
};

function roundMoney(value: number, precision = 2) {
	const factor = 10 ** precision;
	return Math.round((value + Number.EPSILON) * factor) / factor;
}

function toIsoDateLike(date: string) {
	return date?.length === 10 ? date : new Date(date).toISOString().slice(0, 10);
}

function getStartMonthDate(start: string) {
	const iso = toIsoDateLike(start);
	return new Date(`${iso.slice(0, 7)}-01T00:00:00`);
}

function deriveEndPaymentDate(
	installments: Record<string, { sum: number }>,
	firstPayment: string | null
) {
	const keys = Object.keys(installments).map((k) => toIsoDateLike(k)).filter(Boolean).sort();
	if (keys.length > 0) return new Date(`${keys[keys.length - 1]}T00:00:00`);
	if (firstPayment) return new Date(`${toIsoDateLike(firstPayment)}T00:00:00`);
	return null;
}

function shouldDropPackage(
	row: DbRow,
	sessions: number,
	startDate: string,
	installments: Record<string, { sum: number }>
) {
	if (!sessions || sessions <= 0) return false;
	const fullyUsed = toNumber(row.chargeable_total) >= sessions;
	if (!fullyUsed) return false;
	const start = new Date(`${toIsoDateLike(startDate)}T00:00:00`);
	const lastUsed = row.last_used_at ? new Date(row.last_used_at) : null;
	if (!lastUsed || lastUsed >= start) return false;
	const endPayment = deriveEndPaymentDate(installments, row.first_payment_date);
	if (!endPayment) return false;
	const endPaymentMonthStart = new Date(endPayment.getFullYear(), endPayment.getMonth(), 1);
	const startMonthStart = getStartMonthDate(startDate);
	return endPaymentMonthStart < startMonthStart;
}

function getHeaders(endDate: string, startDate: string) {
	const month = startDate.slice(0, 7);
	return [
		'Klient',
		'PaketId',
		'Fakt.nr',
		'Kund (kundnr)',
		'Produkt',
		'Paketets pris',
		'Antal pass',
		'Pris per pass',
		'Antal fakturor',
		`Antal fakt. t.o.m. ${endDate}`,
		'Fakturerade pass',
		'Fakturerad summa',
		'Utnyttjade pass',
		`Utnyttjade pass ${month}`,
		'Återstående pass',
		'Utnyttjad summa',
		`Utnyttjad summa ${month}`,
		'Skuld/fordran i kronor'
	];
}

function removeZeroBalances(rows: ReportRow[]) {
	return rows.filter((r) => Math.abs(r.balance ?? 0) > 0.0001);
}

function formatCustomerCell(row: ReportRow) {
	return row.customerNo ? `${row.customerName} (${row.customerNo})` : row.customerName;
}

function createSummaryFilename(endDate: string) {
	const end = new Date(`${endDate}T00:00:00`);
	const monthFormatter = new Intl.DateTimeFormat('sv-SE', { month: 'short' });
	const monthStr = monthFormatter.format(end).replace('.', '').toLowerCase();
	const now = new Date();
	const nowStamp = `${now.toISOString().slice(0, 10)}_${now
		.toISOString()
		.slice(11, 16)
		.replace(':', '')}`;
	return `resultat_kunders_tillgodohavande_${monthStr}_${end.getFullYear()}_${nowStamp}.xlsx`;
}

async function createWorkbook(): Promise<import('exceljs').Workbook> {
	const mod = await import('exceljs');
	const ExcelJS = (mod as any)?.Workbook ? mod : (mod as any)?.default;
	if (!ExcelJS?.Workbook) {
		throw new Error('ExcelJS module does not expose a Workbook constructor.');
	}
	return new ExcelJS.Workbook();
}

export async function getCustomerCreditReport(
	filters: CustomerCreditReportFilters
): Promise<CustomerCreditReport> {
	const start = toIsoDateLike(filters.startDate);
	const end = toIsoDateLike(filters.endDate);
	const includeZeroBalances = filters.includeZeroBalances ?? false;

	const rawRows = await getCustomerCreditRows(start, end);
	const rows = includeZeroBalances ? rawRows : removeZeroBalances(rawRows);
	const totalBalance = roundMoney(
		rows.reduce((acc, row) => acc + (row.balance ?? 0), 0)
	);

	return { rows, totalBalance, rawRows };
}

export async function buildCustomerCreditWorkbook(filters: CustomerCreditReportFilters) {
	const start = toIsoDateLike(filters.startDate);
	const end = toIsoDateLike(filters.endDate);
	const includeZeroBalances = filters.includeZeroBalances ?? false;

	const { rawRows } = await getCustomerCreditReport({
		startDate: start,
		endDate: end,
		includeZeroBalances: true
	});
	const rows = includeZeroBalances ? rawRows : removeZeroBalances(rawRows);
	const totalBalance = roundMoney(rows.reduce((acc, r) => acc + (r.balance ?? 0), 0));

	const workbook = await createWorkbook();
	const worksheet = workbook.addWorksheet('Tillgodohavande');

	const headers = getHeaders(end, start);
	worksheet.addRow(headers);
	worksheet.getRow(1).font = { bold: true };

	for (const row of rows) {
		worksheet.addRow([
			row.client,
			row.packageId,
			row.invoiceNumbers.join(', '),
			formatCustomerCell(row),
			row.product,
			row.packagePrice,
			row.sessions,
			row.pricePerSession,
			row.invoiceCount,
			row.invoicesUntilEnd,
			row.paidSessions,
			row.paidSum,
			row.usedSessions,
			row.usedSessionsMonth,
			row.remainingSessions,
			row.usedSum,
			row.usedSumMonth,
			row.balance
		]);
	}

	const moneyFmt = '#,##0.00';
	const intFmt = '0';
	const moneyCols = [6, 8, 12, 16, 17, 18];
	const intCols = [2, 7, 9, 10, 11, 13, 14, 15];

	for (const index of moneyCols) {
		worksheet.getColumn(index).numFmt = moneyFmt;
	}
	for (const index of intCols) {
		worksheet.getColumn(index).numFmt = intFmt;
	}

	const totalRow = worksheet.addRow(new Array(headers.length).fill(''));
	totalRow.getCell(headers.length).value = totalBalance;
	totalRow.getCell(headers.length).numFmt = moneyFmt;
	totalRow.font = { bold: true };

	worksheet.views = [{ state: 'frozen', ySplit: 1 }];

	const buffer = (await workbook.xlsx.writeBuffer()) as Uint8Array;
	const filename = createSummaryFilename(end);

	return { buffer, filename };
}

export async function getCustomerCreditRows(
	start_date: string,
	end_date: string
): Promise<ReportRow[]> {
	const sql = `
WITH base AS (
  SELECT p.id AS package_id,
         p.customer_id,
         a.sessions,
         a.name AS product_name,
         a.price AS article_price,
         p.paid_price,
         p.invoice_numbers,
         p.payment_installments_per_date AS installments_text,
         cu.name AS customer_name,
         cu.customer_no,
         (cl.firstname || ' ' || cl.lastname) AS client_name,
         p.first_payment_date
  FROM packages p
  JOIN articles a   ON a.id = p.article_id
  JOIN customers cu ON cu.id = p.customer_id
  LEFT JOIN clients cl ON cl.id = p.client_id
  WHERE p.first_payment_date IS NOT NULL
    AND p.first_payment_date <= $2::date
),
usage AS (
  SELECT bs.package_id,
         COUNT(b.id)::int AS chargeable_total,
         COUNT(b.id) FILTER (WHERE b.start_time <= ($2::date + interval '1 day' - interval '1 second'))::int AS used_total,
         COUNT(b.id) FILTER (WHERE b.start_time >= $1::timestamp
                              AND b.start_time <= ($2::date + interval '1 day' - interval '1 second'))::int AS used_month
  FROM base bs
  LEFT JOIN bookings b ON b.package_id = bs.package_id
    AND COALESCE(b.try_out, false) = false
    AND (
      COALESCE(b.actual_cancel_time, b.cancel_time) IS NULL
      OR b.status IN ('Late Cancelled', 'LateCancelled', 'Late Canceled', 'LateCanceled', 'Late_cancelled')
    )
    AND (b.status IS NULL OR b.status NOT IN ('Cancelled','Canceled','CancelledByUser'))
  GROUP BY bs.package_id
),
last_usage AS (
  SELECT bs.package_id,
         MAX(b.start_time) AS last_used_at
  FROM base bs
  LEFT JOIN bookings b ON b.package_id = bs.package_id
    AND COALESCE(b.try_out, false) = false
    AND (
      COALESCE(b.actual_cancel_time, b.cancel_time) IS NULL
      OR b.status IN ('Late Cancelled', 'LateCancelled', 'Late Canceled', 'LateCanceled', 'Late_cancelled')
    )
    AND (b.status IS NULL OR b.status NOT IN ('Cancelled','Canceled','CancelledByUser'))
  GROUP BY bs.package_id
),
training_client AS (
  SELECT DISTINCT ON (p.id) p.id AS package_id,
         cl.firstname || ' ' || cl.lastname AS fallback_client_name
  FROM packages p
  JOIN client_customer_relationships ccr ON ccr.customer_id = p.customer_id
  JOIN clients cl ON cl.id = ccr.client_id
  WHERE ccr.relationship IN ('Training', 'Training and Membership')
    AND cl.active = true
  ORDER BY p.id, cl.firstname, cl.lastname
)
SELECT b.package_id,
       b.customer_id,
       b.sessions,
       b.product_name,
       b.article_price,
       b.paid_price,
       b.invoice_numbers,
       b.installments_text,
       b.customer_name,
       b.customer_no,
       b.client_name,
       b.first_payment_date,
       CARDINALITY(COALESCE(b.invoice_numbers, ARRAY[]::int[]))::int AS invoice_count,
       COALESCE(u.used_total, 0) AS used_total,
       COALESCE(u.used_month, 0) AS used_month,
       COALESCE(u.chargeable_total, 0) AS chargeable_total,
       lu.last_used_at,
       tc.fallback_client_name
FROM base b
LEFT JOIN usage u ON u.package_id = b.package_id
LEFT JOIN last_usage lu ON lu.package_id = b.package_id
LEFT JOIN training_client tc ON tc.package_id = b.package_id
ORDER BY COALESCE(b.client_name, tc.fallback_client_name, b.customer_name), b.customer_name, b.package_id;`;

	const rows = (await query(sql, [start_date, end_date])) as DbRow[];
	const filteredRows = rows.filter((r) => {
		const sessions = toNumber(r.sessions);
		const installments = parseInstallments(r.installments_text);
		return !shouldDropPackage(r, sessions, start_date, installments);
	});

	return filteredRows.map((r) => {
		const sessions = toNumber(r.sessions);
		const paidPrice = toNumber(r.paid_price);
		const articlePrice = toNumber(r.article_price);
		const invoiceNumbers = (r.invoice_numbers ?? []).map(String);
		const computedPps = sessions > 0 ? paidPrice / sessions : 0;
		const fallbackPps = sessions > 0 ? articlePrice / sessions : 0;
		const ppsExact = computedPps || fallbackPps;
		const pps = Math.round(ppsExact * 100) / 100;

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
		const usedSum = usedTotal * ppsExact;
		const usedSumMonth = usedMonth * ppsExact;
		const paidSessions = ppsExact === 0 ? 0 : paidSum / ppsExact;
		const balance = paidSum - usedSum;

		const clientName = r.client_name || r.fallback_client_name || r.customer_name;

		return {
			client: clientName ?? '',
			packageId: r.package_id,
			invoiceNumbers,
			customerName: r.customer_name,
			customerNo: r.customer_no,
			product: r.product_name,
			packagePrice: paidPrice,
			sessions,
			pricePerSession: pps,
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
