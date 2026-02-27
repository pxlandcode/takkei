import { query } from '$lib/db';
import {
	CANCELLED_STATUS,
	LATE_CANCELLED_STATUS,
	chargeablePackageBookingSql,
	packageFreeExclusionSql
} from '$lib/server/packageSemantics';

type DbRow = {
	booking_id: number;
	start_time: string | null;
	status: string | null;
	client_id: number | null;
	trainer_id: number | null;
	location_id: number | null;
	room_id: number | null;
	package_id: number | null;
	booking_type_key: string;
	client_name: string | null;
	trainer_name: string | null;
	location_name: string | null;
	room_name: string | null;
	booking_content_id: number | null;
	booking_content_kind: string | null;
	package_article_id: number | null;
	package_article_name: string | null;
	try_out: boolean | null;
	internal: boolean | null;
	education: boolean | null;
	internal_education: boolean | null;
	missing_package: boolean | null;
	is_chargeable: boolean | null;
	is_cancelled: boolean | null;
	is_late_cancelled: boolean | null;
	is_saldo_adjustment: boolean | null;
};

type SummaryDbRow = {
	total: number | string | null;
	booked: number | string | null;
	late_cancelled: number | string | null;
	cancelled: number | string | null;
	chargeable: number | string | null;
	missing_package: number | string | null;
	first_booking_at: string | null;
	last_booking_at: string | null;
};

type LocationCountDbRow = {
	location_id: number | null;
	location_name: string | null;
	count_total: number | string | null;
	count_booked: number | string | null;
	count_late_cancelled: number | string | null;
	count_cancelled: number | string | null;
};

type OptionRow = {
	id: number;
	firstname?: string | null;
	lastname?: string | null;
	name?: string | null;
	kind?: string | null;
};

export type BookingReportStatusFilter =
	| 'chargeable'
	| 'booked'
	| 'late_cancelled'
	| 'cancelled'
	| 'all';

export type BookingReportBookingTypeFilter =
	| 'all'
	| 'regular'
	| 'demo'
	| 'education'
	| 'internal'
	| 'internal_education';

export type BookingReportFilters = {
	dateFrom?: string;
	dateTo?: string;
	status?: BookingReportStatusFilter;
	bookingType?: BookingReportBookingTypeFilter;
	trainerId?: number;
	clientId?: number;
	locationId?: number;
	packageArticleId?: number;
	trainingTypeId?: number;
	search?: string;
	limit?: number;
	offset?: number;
};

export type BookingReportRow = {
	bookingId: number;
	startTime: string | null;
	status: string | null;
	statusLabel: string;
	bookingType: Exclude<BookingReportBookingTypeFilter, 'all'>;
	bookingTypeLabel: string;
	clientId: number | null;
	clientName: string | null;
	trainerId: number | null;
	trainerName: string | null;
	locationId: number | null;
	locationName: string | null;
	roomId: number | null;
	roomName: string | null;
	trainingTypeId: number | null;
	trainingTypeKind: string | null;
	packageId: number | null;
	packageArticleId: number | null;
	packageArticleName: string | null;
	missingPackage: boolean;
	isChargeable: boolean;
	isCancelled: boolean;
	isLateCancelled: boolean;
	isDemo: boolean;
	isSaldoAdjustment: boolean;
	markings: string[];
};

export type BookingLocationSummary = {
	locationId: number | null;
	locationName: string;
	total: number;
	booked: number;
	lateCancelled: number;
	cancelled: number;
};

export type BookingReportSummary = {
	total: number;
	booked: number;
	lateCancelled: number;
	cancelled: number;
	chargeable: number;
	missingPackage: number;
	firstBookingAt: string | null;
	lastBookingAt: string | null;
	locationBreakdown: BookingLocationSummary[];
	generatedAt: string;
};

export type BookingReport = {
	rows: BookingReportRow[];
	summary: BookingReportSummary;
	filteredSummary: BookingReportSummary;
};

export type BookingReportOption = {
	id: number;
	label: string;
};

export type BookingReportOptions = {
	trainers: BookingReportOption[];
	clients: BookingReportOption[];
	locations: BookingReportOption[];
	packageArticles: BookingReportOption[];
	trainingTypes: BookingReportOption[];
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

function statusLabel(status: string | null) {
	const normalized = trimOrNull(status);
	if (!normalized || normalized === 'New') return 'Bokad';
	if (normalized === LATE_CANCELLED_STATUS) return 'Sent avbokad';
	if (normalized === CANCELLED_STATUS) return 'Avbokad';
	return normalized;
}

function bookingTypeLabel(bookingTypeKey: DbRow['booking_type_key']): BookingReportRow['bookingTypeLabel'] {
	if (bookingTypeKey === 'demo') return 'Demo';
	if (bookingTypeKey === 'education') return 'Utbildning';
	if (bookingTypeKey === 'internal') return 'Intern';
	if (bookingTypeKey === 'internal_education') return 'Praktiktimme';
	return 'Vanlig';
}

function bookingTypeKey(
	value: DbRow['booking_type_key']
): BookingReportRow['bookingType'] {
	if (
		value === 'demo' ||
		value === 'education' ||
		value === 'internal' ||
		value === 'internal_education'
	) {
		return value;
	}
	return 'regular';
}

function deriveMarkings(row: DbRow) {
	const out: string[] = [];
	if (bool(row.try_out)) out.push('DEMO');
	if (bool(row.is_saldo_adjustment)) out.push('Saldojustering');
	if (bool(row.missing_package)) out.push('Saknar paket');
	return out;
}

function mapRow(row: DbRow): BookingReportRow {
	const resolvedBookingType = bookingTypeKey(row.booking_type_key);
	return {
		bookingId: toInt(row.booking_id),
		startTime: toIsoString(row.start_time),
		status: trimOrNull(row.status),
		statusLabel: statusLabel(row.status),
		bookingType: resolvedBookingType,
		bookingTypeLabel: bookingTypeLabel(row.booking_type_key),
		clientId: row.client_id,
		clientName: trimOrNull(row.client_name),
		trainerId: row.trainer_id,
		trainerName: trimOrNull(row.trainer_name),
		locationId: row.location_id,
		locationName: trimOrNull(row.location_name),
		roomId: row.room_id,
		roomName: trimOrNull(row.room_name),
		trainingTypeId: row.booking_content_id,
		trainingTypeKind: trimOrNull(row.booking_content_kind),
		packageId: row.package_id,
		packageArticleId: row.package_article_id,
		packageArticleName: trimOrNull(row.package_article_name),
		missingPackage: bool(row.missing_package),
		isChargeable: bool(row.is_chargeable),
		isCancelled: bool(row.is_cancelled),
		isLateCancelled: bool(row.is_late_cancelled),
		isDemo: bool(row.try_out),
		isSaldoAdjustment: bool(row.is_saldo_adjustment),
		markings: deriveMarkings(row)
	};
}

function mapLocationRows(rows: LocationCountDbRow[]): BookingLocationSummary[] {
	return rows.map((row) => ({
		locationId: row.location_id,
		locationName: trimOrNull(row.location_name) ?? 'Saknar studio',
		total: toInt(row.count_total),
		booked: toInt(row.count_booked),
		lateCancelled: toInt(row.count_late_cancelled),
		cancelled: toInt(row.count_cancelled)
	}));
}

function mapSummary(
	row: SummaryDbRow | undefined,
	locationRows: LocationCountDbRow[],
	generatedAt: string
): BookingReportSummary {
	return {
		total: toInt(row?.total),
		booked: toInt(row?.booked),
		lateCancelled: toInt(row?.late_cancelled),
		cancelled: toInt(row?.cancelled),
		chargeable: toInt(row?.chargeable),
		missingPackage: toInt(row?.missing_package),
		firstBookingAt: toIsoString(row?.first_booking_at),
		lastBookingAt: toIsoString(row?.last_booking_at),
		locationBreakdown: mapLocationRows(locationRows),
		generatedAt
	};
}

function createBaseCteSql() {
	const bookingTypeExpr = `
CASE
	WHEN COALESCE(b.internal_education, FALSE) = TRUE THEN 'internal_education'
	WHEN COALESCE(b.education, FALSE) = TRUE THEN 'education'
	WHEN COALESCE(b.internal, FALSE) = TRUE THEN 'internal'
	WHEN COALESCE(b.try_out, FALSE) = TRUE THEN 'demo'
	ELSE 'regular'
END`;
	const missingPackageExpr = `(b.client_id IS NOT NULL AND ${chargeablePackageBookingSql('b')} AND ${packageFreeExclusionSql('b')} AND b.package_id IS NULL)`;

	return `
WITH booking_base AS (
	SELECT
		b.id AS booking_id,
		b.start_time,
		b.status,
		b.client_id,
		b.trainer_id,
		b.location_id,
		b.room_id,
		b.package_id,
		${bookingTypeExpr} AS booking_type_key,
		NULLIF(BTRIM(CONCAT_WS(' ', c.firstname, c.lastname)), '') AS client_name,
		NULLIF(BTRIM(CONCAT_WS(' ', u.firstname, u.lastname)), '') AS trainer_name,
		l.name AS location_name,
		r.name AS room_name,
		bc.id AS booking_content_id,
		bc.kind AS booking_content_kind,
		a.id AS package_article_id,
		a.name AS package_article_name,
		COALESCE(b.try_out, FALSE) AS try_out,
		COALESCE(b.internal, FALSE) AS internal,
		COALESCE(b.education, FALSE) AS education,
		COALESCE(b.internal_education, FALSE) AS internal_education,
		CASE WHEN ${missingPackageExpr} THEN TRUE ELSE FALSE END AS missing_package,
		CASE WHEN ${chargeablePackageBookingSql('b')} THEN TRUE ELSE FALSE END AS is_chargeable,
		CASE WHEN COALESCE(b.status, '') = '${CANCELLED_STATUS}' THEN TRUE ELSE FALSE END AS is_cancelled,
		CASE WHEN COALESCE(b.status, '') = '${LATE_CANCELLED_STATUS}' THEN TRUE ELSE FALSE END AS is_late_cancelled,
		CASE WHEN b.room_id IS NULL AND EXTRACT(HOUR FROM b.start_time) = 3 THEN TRUE ELSE FALSE END AS is_saldo_adjustment
	FROM bookings b
	LEFT JOIN clients c ON c.id = b.client_id
	LEFT JOIN users u ON u.id = b.trainer_id
	LEFT JOIN locations l ON l.id = b.location_id
	LEFT JOIN rooms r ON r.id = b.room_id
	LEFT JOIN booking_contents bc ON bc.id = b.booking_content_id
	LEFT JOIN packages p ON p.id = b.package_id
	LEFT JOIN articles a ON a.id = p.article_id
)
`;
}

function buildWhereSql(
	filters: BookingReportFilters,
	includeSearch: boolean
): { whereSql: string; params: unknown[] } {
	const params: unknown[] = [];
	const conditions: string[] = [];

	const dateFrom = normalizeDateParam(filters.dateFrom);
	const dateTo = normalizeDateParam(filters.dateTo);
	const status = filters.status ?? 'chargeable';
	const bookingType = filters.bookingType ?? 'all';
	const search = normalizeSearch(filters.search);

	if (dateFrom) {
		params.push(dateFrom);
		conditions.push(`booking_base.start_time::date >= $${params.length}::date`);
	}

	if (dateTo) {
		params.push(dateTo);
		conditions.push(`booking_base.start_time::date <= $${params.length}::date`);
	}

	if (status === 'chargeable') {
		conditions.push(`${chargeablePackageBookingSql('booking_base')}`);
	} else if (status === 'booked') {
		conditions.push(`COALESCE(booking_base.status, '') <> '${CANCELLED_STATUS}'`);
		conditions.push(`COALESCE(booking_base.status, '') <> '${LATE_CANCELLED_STATUS}'`);
	} else if (status === 'late_cancelled') {
		conditions.push(`COALESCE(booking_base.status, '') = '${LATE_CANCELLED_STATUS}'`);
	} else if (status === 'cancelled') {
		conditions.push(`COALESCE(booking_base.status, '') = '${CANCELLED_STATUS}'`);
	}

	if (bookingType !== 'all') {
		conditions.push(`booking_base.booking_type_key = $${params.length + 1}`);
		params.push(bookingType);
	}

	if (filters.trainerId !== undefined) {
		conditions.push(`booking_base.trainer_id = $${params.length + 1}`);
		params.push(filters.trainerId);
	}

	if (filters.clientId !== undefined) {
		conditions.push(`booking_base.client_id = $${params.length + 1}`);
		params.push(filters.clientId);
	}

	if (filters.locationId !== undefined) {
		conditions.push(`booking_base.location_id = $${params.length + 1}`);
		params.push(filters.locationId);
	}

	if (filters.packageArticleId !== undefined) {
		conditions.push(`booking_base.package_article_id = $${params.length + 1}`);
		params.push(filters.packageArticleId);
	}

	if (filters.trainingTypeId !== undefined) {
		conditions.push(`booking_base.booking_content_id = $${params.length + 1}`);
		params.push(filters.trainingTypeId);
	}

	if (includeSearch && search) {
		params.push(`%${search}%`);
		const searchParam = `$${params.length}`;
		conditions.push(`(
			booking_base.booking_id::text ILIKE ${searchParam}
			OR COALESCE(booking_base.client_name, '') ILIKE ${searchParam}
			OR COALESCE(booking_base.trainer_name, '') ILIKE ${searchParam}
			OR COALESCE(booking_base.location_name, '') ILIKE ${searchParam}
			OR COALESCE(booking_base.room_name, '') ILIKE ${searchParam}
			OR COALESCE(booking_base.status, '') ILIKE ${searchParam}
			OR COALESCE(booking_base.booking_content_kind, '') ILIKE ${searchParam}
			OR COALESCE(booking_base.package_article_name, '') ILIKE ${searchParam}
		)`);
	}

	return {
		whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
		params
	};
}

async function fetchRows(filters: BookingReportFilters): Promise<BookingReportRow[]> {
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
	booking_base.room_id,
	booking_base.package_id,
	booking_base.booking_type_key,
	booking_base.client_name,
	booking_base.trainer_name,
	booking_base.location_name,
	booking_base.room_name,
	booking_base.booking_content_id,
	booking_base.booking_content_kind,
	booking_base.package_article_id,
	booking_base.package_article_name,
	booking_base.try_out,
	booking_base.internal,
	booking_base.education,
	booking_base.internal_education,
	booking_base.missing_package,
	booking_base.is_chargeable,
	booking_base.is_cancelled,
	booking_base.is_late_cancelled,
	booking_base.is_saldo_adjustment
FROM booking_base
${whereSql}
ORDER BY booking_base.start_time DESC NULLS LAST, booking_base.booking_id DESC
${paginationSql}
`;

	const rows = (await query(sql, rowsParams)) as unknown as DbRow[];
	return rows.map(mapRow);
}

async function fetchSummary(
	filters: BookingReportFilters,
	includeSearch: boolean,
	generatedAt: string
): Promise<BookingReportSummary> {
	const { whereSql, params } = buildWhereSql(filters, includeSearch);
	const summarySql = `
${createBaseCteSql()}
SELECT
	COUNT(*)::int AS total,
	COUNT(*) FILTER (
		WHERE COALESCE(booking_base.status, '') <> '${CANCELLED_STATUS}'
		  AND COALESCE(booking_base.status, '') <> '${LATE_CANCELLED_STATUS}'
	)::int AS booked,
	COUNT(*) FILTER (WHERE COALESCE(booking_base.status, '') = '${LATE_CANCELLED_STATUS}')::int AS late_cancelled,
	COUNT(*) FILTER (WHERE COALESCE(booking_base.status, '') = '${CANCELLED_STATUS}')::int AS cancelled,
	COUNT(*) FILTER (WHERE booking_base.is_chargeable = TRUE)::int AS chargeable,
	COUNT(*) FILTER (WHERE booking_base.missing_package = TRUE)::int AS missing_package,
	MIN(booking_base.start_time) AS first_booking_at,
	MAX(booking_base.start_time) AS last_booking_at
FROM booking_base
${whereSql}
`;

	const locationSql = `
${createBaseCteSql()}
SELECT
	booking_base.location_id,
	COALESCE(booking_base.location_name, 'Saknar studio') AS location_name,
	COUNT(*)::int AS count_total,
	COUNT(*) FILTER (
		WHERE COALESCE(booking_base.status, '') <> '${CANCELLED_STATUS}'
		  AND COALESCE(booking_base.status, '') <> '${LATE_CANCELLED_STATUS}'
	)::int AS count_booked,
	COUNT(*) FILTER (WHERE COALESCE(booking_base.status, '') = '${LATE_CANCELLED_STATUS}')::int AS count_late_cancelled,
	COUNT(*) FILTER (WHERE COALESCE(booking_base.status, '') = '${CANCELLED_STATUS}')::int AS count_cancelled
FROM booking_base
${whereSql}
GROUP BY booking_base.location_id, COALESCE(booking_base.location_name, 'Saknar studio')
ORDER BY count_total DESC, location_name ASC
`;

	const [summaryRows, locationRows] = await Promise.all([
		query(summarySql, params) as Promise<SummaryDbRow[]>,
		query(locationSql, params) as Promise<LocationCountDbRow[]>
	]);

	return mapSummary(summaryRows[0], locationRows, generatedAt);
}

export async function getBookingReportRows(
	filters: BookingReportFilters = {}
): Promise<BookingReportRow[]> {
	return fetchRows(filters);
}

export async function getBookingReport(
	filters: BookingReportFilters = {}
): Promise<BookingReport> {
	const generatedAt = new Date().toISOString();
	const [summary, filteredSummary, rows] = await Promise.all([
		fetchSummary(filters, false, generatedAt),
		fetchSummary(filters, true, generatedAt),
		fetchRows(filters)
	]);

	return { rows, summary, filteredSummary };
}

async function fetchOptions(
	sql: string,
	mapper: (row: OptionRow) => BookingReportOption
): Promise<BookingReportOption[]> {
	const rows = (await query(sql)) as unknown as OptionRow[];
	return rows.map(mapper);
}

function mapPersonOption(row: OptionRow) {
	const firstname = trimOrNull(row.firstname) ?? '';
	const lastname = trimOrNull(row.lastname) ?? '';
	const label = [firstname, lastname].filter(Boolean).join(' ').trim() || `#${row.id}`;
	return { id: row.id, label };
}

function mapNameOption(row: OptionRow) {
	const label = trimOrNull(row.name) ?? `#${row.id}`;
	return { id: row.id, label };
}

function mapKindOption(row: OptionRow) {
	const label = trimOrNull(row.kind) ?? `#${row.id}`;
	return { id: row.id, label };
}

export async function getBookingReportOptions(): Promise<BookingReportOptions> {
	const [trainers, clients, locations, packageArticles, trainingTypes] = await Promise.all([
		fetchOptions(
			`
			SELECT DISTINCT u.id, u.firstname, u.lastname
			FROM bookings b
			JOIN users u ON u.id = b.trainer_id
			ORDER BY u.lastname NULLS LAST, u.firstname NULLS LAST
			`,
			mapPersonOption
		),
		fetchOptions(
			`
			SELECT DISTINCT c.id, c.firstname, c.lastname
			FROM bookings b
			JOIN clients c ON c.id = b.client_id
			ORDER BY c.lastname NULLS LAST, c.firstname NULLS LAST
			`,
			mapPersonOption
		),
		fetchOptions(
			`
			SELECT DISTINCT l.id, l.name
			FROM bookings b
			JOIN locations l ON l.id = b.location_id
			ORDER BY l.name NULLS LAST
			`,
			mapNameOption
		),
		fetchOptions(
			`
			SELECT DISTINCT a.id, a.name
			FROM bookings b
			JOIN packages p ON p.id = b.package_id
			JOIN articles a ON a.id = p.article_id
			ORDER BY a.name NULLS LAST
			`,
			mapNameOption
		),
		fetchOptions(
			`
			SELECT id, kind
			FROM booking_contents
			ORDER BY kind NULLS LAST, id ASC
			`,
			mapKindOption
		)
	]);

	return { trainers, clients, locations, packageArticles, trainingTypes };
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

function asDate(value: string | null) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function createFilename(filters: BookingReportFilters, generatedAt: string) {
	const now = new Date(generatedAt);
	const datePart = now.toISOString().slice(0, 10);
	const timePart = now.toISOString().slice(11, 16).replace(':', '');
	const from = normalizeDateParam(filters.dateFrom) ?? 'all';
	const to = normalizeDateParam(filters.dateTo) ?? 'all';
	return `booking_report_${from}_${to}_${datePart}_${timePart}.xlsx`;
}

export async function buildBookingReportWorkbook(
	filters: BookingReportFilters = {}
): Promise<{ buffer: Uint8Array; filename: string }> {
	const generatedAt = new Date().toISOString();
	const rows = await getBookingReportRows({
		...filters,
		limit: undefined,
		offset: undefined
	});
	const workbook = await createWorkbook();
	const worksheet = workbook.addWorksheet('Bokningar');

	worksheet.addRow([
		'Bokning ID',
		'Start',
		'Status',
		'Typ av bokning',
		'Markeringar',
		'Klient',
		'Tränare',
		'Studio',
		'Rum',
		'Typ av träning',
		'Paket ID',
		'Pakettyp',
		'Saknar paket'
	]);
	worksheet.getRow(1).font = { bold: true };

	for (const row of rows) {
		worksheet.addRow([
			row.bookingId,
			asDate(row.startTime),
			row.statusLabel,
			row.bookingTypeLabel,
			row.markings.join(', '),
			row.clientName ?? '',
			row.trainerName ?? '',
			row.locationName ?? '',
			row.roomName ?? '',
			row.trainingTypeKind ?? '',
			row.packageId ?? '',
			row.packageArticleName ?? '',
			row.missingPackage ? 'Ja' : 'Nej'
		]);
	}

	worksheet.getColumn(2).numFmt = 'yyyy-mm-dd hh:mm';
	worksheet.views = [{ state: 'frozen', ySplit: 1 }];

	worksheet.columns?.forEach((column) => {
		if (!column) return;
		let max = 12;
		column.eachCell?.({ includeEmpty: true }, (cell) => {
			const text = cell.value?.toString?.() ?? '';
			if (text.length + 2 > max) max = text.length + 2;
		});
		column.width = Math.min(max, 45);
	});

	const rawBuffer = await workbook.xlsx.writeBuffer();
	const buffer =
		rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer as ArrayBuffer);

	return {
		buffer,
		filename: createFilename(filters, generatedAt)
	};
}
