import { query } from '$lib/db';

const LATE_CANCEL_STATES = [
	'Late Cancelled',
	'LateCancelled',
	'Late Canceled',
	'LateCanceled',
	'Late_cancelled'
];

const HARD_CANCEL_STATES = ['Cancelled', 'Canceled', 'CancelledByUser'];

function toNumber(value: unknown, fallback = 0): number {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return fallback;
}

function toInt(value: unknown, fallback = 0): number {
	const num = Math.trunc(toNumber(value, fallback));
	return Number.isFinite(num) ? num : fallback;
}

function toIsoString(value: unknown): string | null {
	if (!value) return null;
	if (typeof value === 'string') {
		return value.length === 10 ? `${value}T00:00:00.000Z` : value;
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	return null;
}

type DbRow = {
	id: number;
	firstname: string | null;
	lastname: string | null;
	email: string | null;
	phone: string | null;
	active: boolean;
	membership_status: string | null;
	membership_end_time: string | null;
	primary_trainer_id: number | null;
	trainer_firstname: string | null;
	trainer_lastname: string | null;
	created_at: string | null;
	updated_at: string | null;
	total_bookings: number | null;
	bookings_last_90_days: number | null;
	bookings_last_30_days: number | null;
	first_booking_at: string | null;
	last_booking_at: string | null;
	next_booking_at: string | null;
	package_count: number | null;
	active_packages: number | null;
	total_sessions: number | null;
	used_sessions: number | null;
	remaining_sessions: number | null;
	total_package_value: number | null;
	customers: string[] | null;
};

export type ClientReportRow = {
	id: number;
	name: string;
	firstname: string;
	lastname: string;
	email: string | null;
	phone: string | null;
	active: boolean;
	membershipStatus: string | null;
	membershipEndsAt: string | null;
	primaryTrainerId: number | null;
	primaryTrainerName: string | null;
	totalBookings: number;
	bookingsLast90Days: number;
	bookingsLast30Days: number;
	firstBookingAt: string | null;
	lastBookingAt: string | null;
	nextBookingAt: string | null;
	packageCount: number;
	activePackages: number;
	totalSessions: number;
	usedSessions: number;
	remainingSessions: number;
	totalPackageValue: number;
	customers: string[];
	createdAt: string | null;
	updatedAt: string | null;
};

export type ClientReportSummary = {
	total: number;
	active: number;
	inactive: number;
	activeWithRecentBooking: number;
	generatedAt: string;
};

export type ClientReportFilters = {
	active?: 'all' | 'active' | 'inactive';
};

export type ClientReport = {
	rows: ClientReportRow[];
	summary: ClientReportSummary;
	filteredSummary: ClientReportSummary;
};

function summarise(rows: ClientReportRow[], generatedAt: string): ClientReportSummary {
	const total = rows.length;
	const active = rows.filter((r) => r.active).length;
	const inactive = total - active;
	const activeWithRecentBooking = rows.filter((r) => r.active && r.bookingsLast90Days > 0).length;
	return {
		total,
		active,
		inactive,
		activeWithRecentBooking,
		generatedAt
	};
}

function applyActiveFilter(rows: ClientReportRow[], filter: ClientReportFilters['active']) {
	if (!filter || filter === 'all') return rows;
	if (filter === 'active') return rows.filter((r) => r.active);
	if (filter === 'inactive') return rows.filter((r) => !r.active);
	return rows;
}

export async function getClientReportRows(): Promise<ClientReportRow[]> {
	const sql = `
	WITH client_base AS (
		SELECT
			c.id,
			c.firstname,
			c.lastname,
			c.email,
			c.phone,
			c.active,
			c.membership_status,
			c.membership_end_time,
			c.primary_trainer_id,
			u.firstname AS trainer_firstname,
			u.lastname AS trainer_lastname,
			c.created_at,
			c.updated_at
		FROM clients c
		LEFT JOIN users u ON u.id = c.primary_trainer_id
	),
	filtered_bookings AS (
		SELECT
			b.*
		FROM bookings b
		WHERE b.client_id IS NOT NULL
			AND COALESCE(b.try_out, false) = false
			AND (COALESCE(b.actual_cancel_time, b.cancel_time) IS NULL OR b.status = ANY($1))
			AND (b.status IS NULL OR b.status <> ALL($2))
	),
	booking_stats AS (
		SELECT
			fb.client_id,
			COUNT(*) AS total_bookings,
			COUNT(*) FILTER (WHERE fb.start_time >= (NOW() - INTERVAL '90 days')) AS bookings_last_90_days,
			COUNT(*) FILTER (WHERE fb.start_time >= (NOW() - INTERVAL '30 days')) AS bookings_last_30_days,
			MIN(fb.start_time) AS first_booking_at,
			MAX(fb.start_time) FILTER (WHERE fb.start_time <= NOW()) AS last_booking_at,
			MIN(fb.start_time) FILTER (WHERE fb.start_time > NOW()) AS next_booking_at
		FROM filtered_bookings fb
		GROUP BY fb.client_id
	),
	package_stats AS (
		SELECT
			p.client_id,
			COUNT(*) AS package_count,
			COUNT(*) FILTER (
				WHERE COALESCE(p.upgraded, false) = false
					AND (p.frozen_from_date IS NULL OR p.frozen_from_date > NOW())
			) AS active_packages,
			SUM(COALESCE(a.sessions, 0))::int AS total_sessions,
			SUM(COALESCE(p.paid_price, 0)) AS total_package_value
		FROM packages p
		JOIN articles a ON a.id = p.article_id
		WHERE p.client_id IS NOT NULL
		GROUP BY p.client_id
	),
	package_usage AS (
		SELECT
			p.client_id,
			COUNT(fb.id)::int AS used_sessions
		FROM packages p
		LEFT JOIN filtered_bookings fb ON fb.package_id = p.id AND fb.client_id = p.client_id
		WHERE p.client_id IS NOT NULL
		GROUP BY p.client_id
	),
	customer_links AS (
		SELECT
			ccr.client_id,
			ARRAY_AGG(DISTINCT cu.name ORDER BY cu.name) AS customers
		FROM client_customer_relationships ccr
		JOIN customers cu ON cu.id = ccr.customer_id
		WHERE COALESCE(ccr.active, true) = true
		GROUP BY ccr.client_id
	)
	SELECT
		cb.id,
		cb.firstname,
		cb.lastname,
		cb.email,
		cb.phone,
		cb.active,
		cb.membership_status,
		cb.membership_end_time,
		cb.primary_trainer_id,
		cb.trainer_firstname,
		cb.trainer_lastname,
		cb.created_at,
		cb.updated_at,
		COALESCE(bs.total_bookings, 0) AS total_bookings,
		COALESCE(bs.bookings_last_90_days, 0) AS bookings_last_90_days,
		COALESCE(bs.bookings_last_30_days, 0) AS bookings_last_30_days,
		bs.first_booking_at,
		bs.last_booking_at,
		bs.next_booking_at,
		COALESCE(ps.package_count, 0) AS package_count,
		COALESCE(ps.active_packages, 0) AS active_packages,
		COALESCE(ps.total_sessions, 0) AS total_sessions,
		COALESCE(pu.used_sessions, 0) AS used_sessions,
		COALESCE(ps.total_sessions, 0) - COALESCE(pu.used_sessions, 0) AS remaining_sessions,
		COALESCE(ps.total_package_value, 0) AS total_package_value,
		COALESCE(cl.customers, ARRAY[]::text[]) AS customers
	FROM client_base cb
	LEFT JOIN booking_stats bs ON bs.client_id = cb.id
	LEFT JOIN package_stats ps ON ps.client_id = cb.id
	LEFT JOIN package_usage pu ON pu.client_id = cb.id
	LEFT JOIN customer_links cl ON cl.client_id = cb.id
	ORDER BY LOWER(COALESCE(cb.lastname, '')), LOWER(COALESCE(cb.firstname, ''))
	`;

	const rows = (await query(sql, [LATE_CANCEL_STATES, HARD_CANCEL_STATES])) as unknown as DbRow[];

	return rows.map((row) => {
		const firstname = row.firstname?.trim() ?? '';
		const lastname = row.lastname?.trim() ?? '';
		const name = [firstname, lastname].filter(Boolean).join(' ').trim() || '(namn saknas)';
		const totalSessions = Math.max(0, toInt(row.total_sessions));
		const usedSessions = Math.max(0, Math.min(totalSessions, toInt(row.used_sessions)));
		const remainingSessions = Math.max(0, totalSessions - usedSessions);

		const primaryTrainerName = [row.trainer_firstname, row.trainer_lastname]
			.map((p) => (p ?? '').trim())
			.filter(Boolean)
			.join(' ');

		return {
			id: row.id,
			name,
			firstname,
			lastname,
			email: row.email?.trim() || null,
			phone: row.phone?.trim() || null,
			active: Boolean(row.active),
			membershipStatus: row.membership_status,
			membershipEndsAt: toIsoString(row.membership_end_time),
			primaryTrainerId: row.primary_trainer_id,
			primaryTrainerName: primaryTrainerName || null,
			totalBookings: toInt(row.total_bookings),
			bookingsLast90Days: toInt(row.bookings_last_90_days),
			bookingsLast30Days: toInt(row.bookings_last_30_days),
			firstBookingAt: toIsoString(row.first_booking_at),
			lastBookingAt: toIsoString(row.last_booking_at),
			nextBookingAt: toIsoString(row.next_booking_at),
			packageCount: toInt(row.package_count),
			activePackages: toInt(row.active_packages),
			totalSessions,
			usedSessions,
			remainingSessions,
			totalPackageValue: toNumber(row.total_package_value),
			customers: Array.isArray(row.customers) ? row.customers : [],
			createdAt: toIsoString(row.created_at),
			updatedAt: toIsoString(row.updated_at)
		};
	});
}

export async function getClientReport(filters: ClientReportFilters = {}): Promise<ClientReport> {
	const generatedAt = new Date().toISOString();
	const allRows = await getClientReportRows();
	const summary = summarise(allRows, generatedAt);
	const filteredRows = applyActiveFilter(allRows, filters.active);
	const filteredSummary = summarise(filteredRows, generatedAt);

	return {
		rows: filteredRows,
		summary,
		filteredSummary
	};
}

type ExcelModule = typeof import('exceljs');

async function createWorkbook(): Promise<import('exceljs').Workbook> {
	const mod = (await import('exceljs')) as ExcelModule & { default?: ExcelModule };
	const excelNs = mod.Workbook ? mod : mod.default;
	if (!excelNs?.Workbook) {
		throw new Error('ExcelJS module does not expose a Workbook constructor.');
	}
	return new excelNs.Workbook();
}

function formatBoolean(value: boolean) {
	return value ? 'Ja' : 'Nej';
}

function asDate(value: string | null) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function formatCustomers(customers: string[]) {
	return customers.join(', ');
}

function createFilename(filters: ClientReportFilters, generatedAt: string) {
	const now = new Date(generatedAt);
	const datePart = now.toISOString().slice(0, 10);
	const timePart = now.toISOString().slice(11, 16).replace(':', '');
	const suffix =
		filters.active === 'active' ? 'aktiva' : filters.active === 'inactive' ? 'inaktiva' : 'alla';
	return `client_report_${suffix}_${datePart}_${timePart}.xlsx`;
}

export async function buildClientReportWorkbook(filters: ClientReportFilters = {}) {
	const generatedAt = new Date().toISOString();
	const { rows } = await getClientReport(filters);
	const workbook = await createWorkbook();
	const worksheet = workbook.addWorksheet('Klienter');

	worksheet.addRow([
		'Namn',
		'Aktiv',
		'Medlemsstatus',
		'Medlemskap upphör',
		'Primär tränare',
		'E-post',
		'Telefon',
		'Totala bokningar',
		'Bokningar 90 dagar',
		'Bokningar 30 dagar',
		'Första bokning',
		'Senaste bokning',
		'Nästa bokning',
		'Antal paket',
		'Aktiva paket',
		'Totala pass',
		'Använda pass',
		'Återstående pass',
		'Betald summa paket',
		'Kopplade kunder',
		'Skapad',
		'Uppdaterad'
	]);
	worksheet.getRow(1).font = { bold: true };

	for (const row of rows) {
		worksheet.addRow([
			row.name,
			formatBoolean(row.active),
			row.membershipStatus ?? '',
			asDate(row.membershipEndsAt),
			row.primaryTrainerName ?? '',
			row.email ?? '',
			row.phone ?? '',
			row.totalBookings,
			row.bookingsLast90Days,
			row.bookingsLast30Days,
			asDate(row.firstBookingAt),
			asDate(row.lastBookingAt),
			asDate(row.nextBookingAt),
			row.packageCount,
			row.activePackages,
			row.totalSessions,
			row.usedSessions,
			row.remainingSessions,
			row.totalPackageValue,
			formatCustomers(row.customers),
			asDate(row.createdAt),
			asDate(row.updatedAt)
		]);
	}

	const numericColumns = [8, 9, 10, 14, 15, 16, 17, 18];
	for (const colIndex of numericColumns) {
		worksheet.getColumn(colIndex).numFmt = '0';
	}
	worksheet.getColumn(19).numFmt = '#,##0.00';

	const dateColumns = [4, 11, 12, 13, 21, 22];
	for (const colIndex of dateColumns) {
		worksheet.getColumn(colIndex).numFmt = 'yyyy-mm-dd hh:mm';
	}

	worksheet.columns?.forEach((column) => {
		if (!column) return;
		let max = 12;
		column.eachCell?.({ includeEmpty: true }, (cell) => {
			const text = cell.value?.toString?.() ?? '';
			if (text.length + 2 > max) max = text.length + 2;
		});
		column.width = Math.min(max, 50);
	});

	worksheet.views = [{ state: 'frozen', ySplit: 1 }];

	const totalsRow = worksheet.addRow(new Array(worksheet.columnCount).fill(''));
	totalsRow.getCell(1).value = 'Totalt';
	totalsRow.font = { bold: true };

	const aggregate = rows.reduce(
		(acc, row) => {
			acc.totalBookings += row.totalBookings;
			acc.bookings90 += row.bookingsLast90Days;
			acc.bookings30 += row.bookingsLast30Days;
			acc.totalPackages += row.packageCount;
			acc.activePackages += row.activePackages;
			acc.totalSessions += row.totalSessions;
			acc.usedSessions += row.usedSessions;
			acc.remainingSessions += row.remainingSessions;
			acc.totalValue += row.totalPackageValue;
			return acc;
		},
		{
			totalBookings: 0,
			bookings90: 0,
			bookings30: 0,
			totalPackages: 0,
			activePackages: 0,
			totalSessions: 0,
			usedSessions: 0,
			remainingSessions: 0,
			totalValue: 0
		}
	);

	totalsRow.getCell(8).value = aggregate.totalBookings;
	totalsRow.getCell(9).value = aggregate.bookings90;
	totalsRow.getCell(10).value = aggregate.bookings30;
	totalsRow.getCell(14).value = aggregate.totalPackages;
	totalsRow.getCell(15).value = aggregate.activePackages;
	totalsRow.getCell(16).value = aggregate.totalSessions;
	totalsRow.getCell(17).value = aggregate.usedSessions;
	totalsRow.getCell(18).value = aggregate.remainingSessions;
	totalsRow.getCell(19).value = aggregate.totalValue;
	totalsRow.getCell(19).numFmt = '#,##0.00';

	const rawBuffer = await workbook.xlsx.writeBuffer();
	const buffer =
		rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer as ArrayBuffer);
	const filename = createFilename(filters, generatedAt);

	return { buffer, filename };
}
