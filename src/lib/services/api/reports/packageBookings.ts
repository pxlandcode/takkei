import { query } from '$lib/db';
import {
	CANCELLED_STATUS,
	LATE_CANCELLED_STATUS,
	chargeablePackageBookingSql,
	packageFreeExclusionSql,
	trainingRelationshipSql
} from '$lib/server/packageSemantics';

type DbRow = {
	booking_id: number;
	start_time: string | null;
	status: string | null;
	client_id: number | null;
	trainer_id: number | null;
	location_id: number | null;
	package_id: number | null;
	added_to_package_date: string | null;
	internal: boolean | null;
	education: boolean | null;
	try_out: boolean | null;
	internal_education: boolean | null;
	client_name: string | null;
	trainer_name: string | null;
	location_name: string | null;
	booking_kind: string | null;
	client_customers_text: string | null;
	package_article_name: string | null;
	package_customer_name: string | null;
	package_client_name: string | null;
	package_paid_price: string | number | null;
	package_sessions: number | null;
	package_relevant: boolean | null;
	has_package: boolean | null;
	no_package: boolean | null;
	missing_package: boolean | null;
	package_not_applicable: boolean | null;
	is_cancelled: boolean | null;
	is_late_cancelled: boolean | null;
};

type SummaryDbRow = {
	total: number | string | null;
	linked: number | string | null;
	without_package: number | string | null;
	missing_package: number | string | null;
	not_applicable: number | string | null;
	package_relevant: number | string | null;
	cancelled: number | string | null;
	late_cancelled: number | string | null;
	first_booking_at: string | null;
	last_booking_at: string | null;
};

export type PackageBookingReportPackageStatus =
	| 'all'
	| 'missing'
	| 'linked';

export type PackageBookingReportCancellation =
	| 'chargeable'
	| 'booked_only'
	| 'late_cancelled_only';

export type PackageBookingReportFilters = {
	dateFrom?: string;
	dateTo?: string;
	packageStatus?: PackageBookingReportPackageStatus;
	cancellation?: PackageBookingReportCancellation;
	search?: string;
	limit?: number;
	offset?: number;
};

export type PackageBookingRow = {
	bookingId: number;
	startTime: string | null;
	status: string | null;
	clientId: number | null;
	clientName: string | null;
	clientCustomers: string | null;
	trainerId: number | null;
	trainerName: string | null;
	locationId: number | null;
	locationName: string | null;
	bookingKind: string | null;
	packageId: number | null;
	packageArticleName: string | null;
	packageCustomerName: string | null;
	packageClientName: string | null;
	packagePaidPrice: number | null;
	packageSessions: number | null;
	addedToPackageDate: string | null;
	internal: boolean;
	education: boolean;
	tryOut: boolean;
	internalEducation: boolean;
	packageRelevant: boolean;
	hasPackage: boolean;
	noPackage: boolean;
	missingPackage: boolean;
	packageNotApplicable: boolean;
	isCancelled: boolean;
	isLateCancelled: boolean;
	packageStatus: 'linked' | 'missing';
	packageStatusLabel: string;
};

export type PackageBookingReportSummary = {
	total: number;
	linked: number;
	withoutPackage: number;
	missingPackage: number;
	notApplicable: number;
	packageRelevant: number;
	cancelled: number;
	lateCancelled: number;
	firstBookingAt: string | null;
	lastBookingAt: string | null;
	generatedAt: string;
};

export type PackageBookingReport = {
	rows: PackageBookingRow[];
	summary: PackageBookingReportSummary;
	filteredSummary: PackageBookingReportSummary;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function toNumber(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function toInt(value: unknown, fallback = 0): number {
	const parsed = toNumber(value);
	if (parsed === null) return fallback;
	const truncated = Math.trunc(parsed);
	return Number.isFinite(truncated) ? truncated : fallback;
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

function trimOrNull(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
}

function bool(value: unknown) {
	return value === true;
}

function formatBoolean(value: boolean) {
	return value ? 'Ja' : 'Nej';
}

function asDate(value: string | null) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDateParam(value?: string) {
	if (!value) return undefined;
	const trimmed = value.trim();
	return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function normalizeSearch(value?: string) {
	if (!value) return undefined;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : undefined;
}

function sanitizeLimit(limit?: number) {
	if (limit === undefined || limit === null) return undefined;
	const parsed = Math.trunc(Number(limit));
	if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
	return Math.min(parsed, MAX_PAGE_SIZE);
}

function sanitizeOffset(offset?: number) {
	if (offset === undefined || offset === null) return 0;
	const parsed = Math.trunc(Number(offset));
	if (!Number.isFinite(parsed) || parsed < 0) return 0;
	return parsed;
}

function getPackageStatusLabel(hasPackage: boolean): PackageBookingRow['packageStatusLabel'] {
	if (hasPackage) return 'Har paket';
	return 'Saknar paket';
}

function deriveBookingKind(row: DbRow): string | null {
	const explicitKind = trimOrNull(row.booking_kind);
	if (explicitKind) return explicitKind;
	if (bool(row.internal_education)) return 'Praktiktimme';
	if (bool(row.education)) return 'Utbildning';
	if (bool(row.internal)) return 'Intern';
	if (bool(row.try_out)) return 'Prova på';
	return null;
}

function mapRow(row: DbRow): PackageBookingRow {
	const hasPackage = bool(row.has_package);
	const missingPackage = bool(row.missing_package);
	const packageStatus: PackageBookingRow['packageStatus'] = hasPackage
		? 'linked'
		: 'missing';

	return {
		bookingId: toInt(row.booking_id),
		startTime: toIsoString(row.start_time),
		status: trimOrNull(row.status),
		clientId: row.client_id,
		clientName: trimOrNull(row.client_name),
		clientCustomers: trimOrNull(row.client_customers_text),
		trainerId: row.trainer_id,
		trainerName: trimOrNull(row.trainer_name),
		locationId: row.location_id,
		locationName: trimOrNull(row.location_name),
		bookingKind: deriveBookingKind(row),
		packageId: row.package_id,
		packageArticleName: trimOrNull(row.package_article_name),
		packageCustomerName: trimOrNull(row.package_customer_name),
		packageClientName: trimOrNull(row.package_client_name),
		packagePaidPrice: toNumber(row.package_paid_price),
		packageSessions: row.package_sessions === null ? null : toInt(row.package_sessions),
		addedToPackageDate: toIsoString(row.added_to_package_date),
		internal: bool(row.internal),
		education: bool(row.education),
		tryOut: bool(row.try_out),
		internalEducation: bool(row.internal_education),
		packageRelevant: bool(row.package_relevant),
		hasPackage,
		noPackage: bool(row.no_package),
		missingPackage,
		packageNotApplicable: bool(row.package_not_applicable),
		isCancelled: bool(row.is_cancelled),
		isLateCancelled: bool(row.is_late_cancelled),
		packageStatus,
		packageStatusLabel: getPackageStatusLabel(hasPackage)
	};
}

function mapSummary(row: SummaryDbRow | undefined, generatedAt: string): PackageBookingReportSummary {
	return {
		total: toInt(row?.total),
		linked: toInt(row?.linked),
		withoutPackage: toInt(row?.without_package),
		missingPackage: toInt(row?.missing_package),
		notApplicable: toInt(row?.not_applicable),
		packageRelevant: toInt(row?.package_relevant),
		cancelled: toInt(row?.cancelled),
		lateCancelled: toInt(row?.late_cancelled),
		firstBookingAt: toIsoString(row?.first_booking_at),
		lastBookingAt: toIsoString(row?.last_booking_at),
		generatedAt
	};
}

function createBaseCteSql() {
	const packageRelevantExpr = `(b.client_id IS NOT NULL AND ${chargeablePackageBookingSql('b')} AND ${packageFreeExclusionSql('b')})`;
	const isCancelledExpr = `(COALESCE(b.status, '') IN ('${CANCELLED_STATUS}', '${LATE_CANCELLED_STATUS}'))`;

	return `
WITH booking_base AS (
	SELECT
		b.id AS booking_id,
		b.start_time,
		b.status,
		b.client_id,
		b.trainer_id,
		b.location_id,
		b.package_id,
		b.added_to_package_date,
		COALESCE(b.internal, FALSE) AS internal,
		COALESCE(b.education, FALSE) AS education,
		COALESCE(b.try_out, FALSE) AS try_out,
		COALESCE(b.internal_education, FALSE) AS internal_education,
		NULLIF(BTRIM(CONCAT_WS(' ', c.firstname, c.lastname)), '') AS client_name,
		NULLIF(BTRIM(CONCAT_WS(' ', u.firstname, u.lastname)), '') AS trainer_name,
		l.name AS location_name,
		bc.kind AS booking_kind,
		cust.customer_names AS client_customers_text,
		a.name AS package_article_name,
		pc.name AS package_customer_name,
		NULLIF(BTRIM(CONCAT_WS(' ', pcl.firstname, pcl.lastname)), '') AS package_client_name,
		p.paid_price AS package_paid_price,
		a.sessions AS package_sessions,
		CASE WHEN ${packageRelevantExpr} THEN TRUE ELSE FALSE END AS package_relevant,
		CASE WHEN b.package_id IS NOT NULL THEN TRUE ELSE FALSE END AS has_package,
		CASE WHEN b.package_id IS NULL THEN TRUE ELSE FALSE END AS no_package,
		CASE WHEN ${packageRelevantExpr} AND b.package_id IS NULL THEN TRUE ELSE FALSE END AS missing_package,
		CASE WHEN (NOT (${packageRelevantExpr})) AND b.package_id IS NULL THEN TRUE ELSE FALSE END AS package_not_applicable,
		CASE WHEN ${isCancelledExpr} THEN TRUE ELSE FALSE END AS is_cancelled,
		CASE WHEN COALESCE(b.status, '') = '${LATE_CANCELLED_STATUS}' THEN TRUE ELSE FALSE END AS is_late_cancelled
	FROM bookings b
	LEFT JOIN clients c ON c.id = b.client_id
	LEFT JOIN users u ON u.id = b.trainer_id
	LEFT JOIN locations l ON l.id = b.location_id
	LEFT JOIN booking_contents bc ON bc.id = b.booking_content_id
	LEFT JOIN packages p ON p.id = b.package_id
	LEFT JOIN articles a ON a.id = p.article_id
	LEFT JOIN customers pc ON pc.id = p.customer_id
	LEFT JOIN clients pcl ON pcl.id = p.client_id
	LEFT JOIN LATERAL (
		SELECT STRING_AGG(cu.name, ', ' ORDER BY LOWER(cu.name)) AS customer_names
		FROM client_customer_relationships ccr
		JOIN customers cu ON cu.id = ccr.customer_id
		WHERE ccr.client_id = b.client_id
			AND ${trainingRelationshipSql('ccr')}
	) cust ON TRUE
)
`;
}

function buildWhereSql(
	filters: PackageBookingReportFilters,
	includeNarrowingFilters: boolean
): { whereSql: string; params: unknown[] } {
	const params: unknown[] = [];
	const conditions: string[] = [];

	const dateFrom = normalizeDateParam(filters.dateFrom);
	const dateTo = normalizeDateParam(filters.dateTo);
	const packageStatus = filters.packageStatus ?? 'all';
	const cancellation = filters.cancellation ?? 'chargeable';
	const search = normalizeSearch(filters.search);

	// This report is package-focused only.
	conditions.push(`booking_base.package_relevant = TRUE`);

	if (dateFrom) {
		params.push(dateFrom);
		conditions.push(`booking_base.start_time::date >= $${params.length}::date`);
	}

	if (dateTo) {
		params.push(dateTo);
		conditions.push(`booking_base.start_time::date <= $${params.length}::date`);
	}

	if (cancellation === 'chargeable') {
		conditions.push(`${chargeablePackageBookingSql('booking_base')}`);
	} else if (cancellation === 'booked_only') {
		conditions.push(`COALESCE(booking_base.status, '') <> '${CANCELLED_STATUS}'`);
		conditions.push(`COALESCE(booking_base.status, '') <> '${LATE_CANCELLED_STATUS}'`);
	} else if (cancellation === 'late_cancelled_only') {
		conditions.push(`COALESCE(booking_base.status, '') = '${LATE_CANCELLED_STATUS}'`);
	}

	if (includeNarrowingFilters) {
		if (packageStatus === 'missing') {
			conditions.push(`booking_base.missing_package = TRUE`);
		} else if (packageStatus === 'linked') {
			conditions.push(`booking_base.has_package = TRUE`);
		}

		if (search) {
			params.push(`%${search}%`);
			const searchParam = `$${params.length}`;
			conditions.push(`(
				booking_base.booking_id::text ILIKE ${searchParam}
				OR COALESCE(booking_base.client_name, '') ILIKE ${searchParam}
				OR COALESCE(booking_base.client_customers_text, '') ILIKE ${searchParam}
				OR COALESCE(booking_base.trainer_name, '') ILIKE ${searchParam}
				OR COALESCE(booking_base.location_name, '') ILIKE ${searchParam}
				OR COALESCE(booking_base.booking_kind, '') ILIKE ${searchParam}
				OR COALESCE(booking_base.status, '') ILIKE ${searchParam}
				OR COALESCE(booking_base.package_id::text, '') ILIKE ${searchParam}
				OR COALESCE(booking_base.package_article_name, '') ILIKE ${searchParam}
				OR COALESCE(booking_base.package_customer_name, '') ILIKE ${searchParam}
				OR COALESCE(booking_base.package_client_name, '') ILIKE ${searchParam}
			)`);
		}
	}

	return {
		whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
		params
	};
}

async function fetchRows(filters: PackageBookingReportFilters): Promise<PackageBookingRow[]> {
	const { whereSql, params } = buildWhereSql(filters, true);
	const rowsParams = [...params];
	const hasExplicitLimit = filters.limit !== undefined && filters.limit !== null;
	const limit = sanitizeLimit(filters.limit);
	const offset = sanitizeOffset(filters.offset);

	let paginationSql = '';
	if (hasExplicitLimit) {
		rowsParams.push(limit ?? DEFAULT_PAGE_SIZE);
		rowsParams.push(offset);
		paginationSql = `LIMIT $${rowsParams.length - 1} OFFSET $${rowsParams.length}`;
	} else if (offset > 0) {
		rowsParams.push(offset);
		paginationSql = `OFFSET $${rowsParams.length}`;
	}

	const sql = `
${createBaseCteSql()}
SELECT
	booking_base.booking_id,
	booking_base.start_time,
	booking_base.status,
	booking_base.client_id,
	booking_base.trainer_id,
	booking_base.location_id,
	booking_base.package_id,
	booking_base.added_to_package_date,
	booking_base.internal,
	booking_base.education,
	booking_base.try_out,
	booking_base.internal_education,
	booking_base.client_name,
	booking_base.trainer_name,
	booking_base.location_name,
	booking_base.booking_kind,
	booking_base.client_customers_text,
	booking_base.package_article_name,
	booking_base.package_customer_name,
	booking_base.package_client_name,
	booking_base.package_paid_price,
	booking_base.package_sessions,
	booking_base.package_relevant,
	booking_base.has_package,
	booking_base.no_package,
	booking_base.missing_package,
	booking_base.package_not_applicable,
	booking_base.is_cancelled,
	booking_base.is_late_cancelled
FROM booking_base
${whereSql}
ORDER BY booking_base.start_time DESC NULLS LAST, booking_base.booking_id DESC
${paginationSql}
`;

	const rows = (await query(sql, rowsParams)) as unknown as DbRow[];
	return rows.map(mapRow);
}

async function fetchSummary(
	filters: PackageBookingReportFilters,
	includeNarrowingFilters: boolean,
	generatedAt: string
): Promise<PackageBookingReportSummary> {
	const { whereSql, params } = buildWhereSql(filters, includeNarrowingFilters);
	const sql = `
${createBaseCteSql()}
SELECT
	COUNT(*)::int AS total,
	COUNT(*) FILTER (WHERE booking_base.has_package = TRUE)::int AS linked,
	COUNT(*) FILTER (WHERE booking_base.no_package = TRUE)::int AS without_package,
	COUNT(*) FILTER (WHERE booking_base.missing_package = TRUE)::int AS missing_package,
	COUNT(*) FILTER (WHERE booking_base.package_not_applicable = TRUE)::int AS not_applicable,
	COUNT(*) FILTER (WHERE booking_base.package_relevant = TRUE)::int AS package_relevant,
	COUNT(*) FILTER (WHERE booking_base.is_cancelled = TRUE)::int AS cancelled,
	COUNT(*) FILTER (WHERE booking_base.is_late_cancelled = TRUE)::int AS late_cancelled,
	MIN(booking_base.start_time) AS first_booking_at,
	MAX(booking_base.start_time) AS last_booking_at
FROM booking_base
${whereSql}
`;

	const [row] = (await query(sql, params)) as unknown as SummaryDbRow[];
	return mapSummary(row, generatedAt);
}

export async function getPackageBookingReportRows(
	filters: PackageBookingReportFilters = {}
): Promise<PackageBookingRow[]> {
	return fetchRows(filters);
}

export async function getPackageBookingReport(
	filters: PackageBookingReportFilters = {}
): Promise<PackageBookingReport> {
	const generatedAt = new Date().toISOString();
	const [summary, filteredSummary, rows] = await Promise.all([
		fetchSummary(filters, false, generatedAt),
		fetchSummary(filters, true, generatedAt),
		fetchRows(filters)
	]);

	return { rows, summary, filteredSummary };
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

function createFilename(filters: PackageBookingReportFilters, generatedAt: string) {
	const now = new Date(generatedAt);
	const datePart = now.toISOString().slice(0, 10);
	const timePart = now.toISOString().slice(11, 16).replace(':', '');
	const from = normalizeDateParam(filters.dateFrom) ?? 'all';
	const to = normalizeDateParam(filters.dateTo) ?? 'all';
	const status = filters.packageStatus ?? 'all';
	return `package_bookings_${status}_${from}_${to}_${datePart}_${timePart}.xlsx`;
}

export async function buildPackageBookingReportWorkbook(
	filters: PackageBookingReportFilters = {}
): Promise<{ buffer: Uint8Array; filename: string }> {
	const generatedAt = new Date().toISOString();
	const rows = await getPackageBookingReportRows({
		...filters,
		limit: undefined,
		offset: undefined
	});

	const workbook = await createWorkbook();
	const worksheet = workbook.addWorksheet('Paketbokningar');

	worksheet.addRow([
		'Bokning ID',
		'Starttid',
		'Status',
		'Paketstatus',
		'Paketrelevant',
		'Klient',
		'Klientens kunder',
		'Tränare',
		'Plats',
		'Bokningstyp',
		'Paket ID',
		'Paketprodukt',
		'Paketkund',
		'Paketklient',
		'Paketpris',
		'Paketsessioner',
		'Tillagd till paket',
		'Intern',
		'Utbildning',
		'Prova på',
		'Intern utbildning',
		'Avbokad',
		'Sent avbokad'
	]);
	worksheet.getRow(1).font = { bold: true };

	for (const row of rows) {
		worksheet.addRow([
			row.bookingId,
			asDate(row.startTime),
			row.status ?? '',
			row.packageStatusLabel,
			formatBoolean(row.packageRelevant),
			row.clientName ?? '',
			row.clientCustomers ?? '',
			row.trainerName ?? '',
			row.locationName ?? '',
			row.bookingKind ?? '',
			row.packageId ?? '',
			row.packageArticleName ?? '',
			row.packageCustomerName ?? '',
			row.packageClientName ?? '',
			row.packagePaidPrice ?? '',
			row.packageSessions ?? '',
			asDate(row.addedToPackageDate),
			formatBoolean(row.internal),
			formatBoolean(row.education),
			formatBoolean(row.tryOut),
			formatBoolean(row.internalEducation),
			formatBoolean(row.isCancelled),
			formatBoolean(row.isLateCancelled)
		]);
	}

	worksheet.getColumn(2).numFmt = 'yyyy-mm-dd hh:mm';
	worksheet.getColumn(17).numFmt = 'yyyy-mm-dd hh:mm';
	worksheet.getColumn(15).numFmt = '#,##0.00';

	worksheet.columns?.forEach((column) => {
		if (!column) return;
		let max = 12;
		column.eachCell?.({ includeEmpty: true }, (cell) => {
			const text = cell.value?.toString?.() ?? '';
			if (text.length + 2 > max) max = text.length + 2;
		});
		column.width = Math.min(max, 45);
	});

	worksheet.views = [{ state: 'frozen', ySplit: 1 }];

	const totalsRow = worksheet.addRow(new Array(worksheet.columnCount).fill(''));
	totalsRow.getCell(1).value = 'Totalt';
	totalsRow.font = { bold: true };
	totalsRow.getCell(11).value = rows.filter((row) => row.packageId !== null).length;
	totalsRow.getCell(22).value = rows.filter((row) => row.isCancelled).length;
	totalsRow.getCell(23).value = rows.filter((row) => row.isLateCancelled).length;

	const rawBuffer = await workbook.xlsx.writeBuffer();
	const buffer =
		rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer as ArrayBuffer);

	return {
		buffer,
		filename: createFilename(filters, generatedAt)
	};
}
