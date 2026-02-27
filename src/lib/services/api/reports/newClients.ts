import { query } from '$lib/db';
import { CANCELLED_STATUS } from '$lib/server/packageSemantics';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

type ReportPeriod = {
	startDate: string;
	endDate: string;
};

type DbRow = {
	id: number;
	firstname: string | null;
	lastname: string | null;
	email: string | null;
	phone: string | null;
	active: boolean;
	primary_trainer_id: number | null;
	trainer_firstname: string | null;
	trainer_lastname: string | null;
	primary_location_id: number | null;
	location_name: string | null;
	created_at: string | null;
	first_booking_at: string | null;
	first_trial_booking_at: string | null;
	first_regular_booking_at: string | null;
	first_started_booking_at: string | null;
	trial_bookings: number | null;
	regular_bookings: number | null;
	total_bookings: number | null;
};

type OptionRow = {
	id: number;
	firstname?: string | null;
	lastname?: string | null;
	name?: string | null;
};

export type NewClientsReportActiveFilter = 'all' | 'active' | 'inactive';
export type NewClientsReportStartedFilter = 'all' | 'started' | 'not_started';

export type NewClientsReportFilters = {
	active?: NewClientsReportActiveFilter;
	started?: NewClientsReportStartedFilter;
	trainerId?: number;
	locationId?: number;
	dateFrom?: string;
	dateTo?: string;
	search?: string;
	limit?: number;
	offset?: number;
};

export type NewClientsReportRow = {
	id: number;
	name: string;
	firstname: string;
	lastname: string;
	email: string | null;
	phone: string | null;
	active: boolean;
	hasStarted: boolean;
	primaryTrainerId: number | null;
	primaryTrainerName: string | null;
	primaryLocationId: number | null;
	primaryLocationName: string | null;
	createdAt: string | null;
	firstBookingAt: string | null;
	firstTrialBookingAt: string | null;
	firstRegularBookingAt: string | null;
	trialBookings: number;
	regularBookings: number;
	totalBookings: number;
};

export type NewClientsReportSummary = {
	total: number;
	active: number;
	inactive: number;
	started: number;
	notStarted: number;
	withTrialBookings: number;
	trialBookingsTotal: number;
	withFirstBooking: number;
	withFirstRegularBooking: number;
	generatedAt: string;
	periodStart: string;
	periodEnd: string;
};

export type NewClientsReport = {
	rows: NewClientsReportRow[];
	summary: NewClientsReportSummary;
	filteredSummary: NewClientsReportSummary;
};

export type NewClientsReportOption = {
	id: number;
	label: string;
};

export type NewClientsReportOptions = {
	trainers: NewClientsReportOption[];
	locations: NewClientsReportOption[];
};

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

function firstDayOfMonth(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	return `${year}-${month}-01`;
}

function lastDayOfMonth(date = new Date()) {
	const year = date.getFullYear();
	const month = date.getMonth();
	const last = new Date(year, month + 1, 0);
	const m = String(last.getMonth() + 1).padStart(2, '0');
	const day = String(last.getDate()).padStart(2, '0');
	return `${last.getFullYear()}-${m}-${day}`;
}

function resolvePeriod(filters: NewClientsReportFilters): ReportPeriod {
	let startDate = normalizeDateParam(filters.dateFrom);
	let endDate = normalizeDateParam(filters.dateTo);

	if (!startDate && !endDate) {
		return {
			startDate: firstDayOfMonth(),
			endDate: lastDayOfMonth()
		};
	}

	if (!startDate && endDate) startDate = endDate;
	if (!endDate && startDate) endDate = startDate;

	if (!startDate || !endDate) {
		return {
			startDate: firstDayOfMonth(),
			endDate: lastDayOfMonth()
		};
	}

	if (startDate > endDate) {
		return { startDate: endDate, endDate: startDate };
	}

	return { startDate, endDate };
}

function applyActiveFilter(rows: NewClientsReportRow[], filter?: NewClientsReportActiveFilter) {
	if (!filter || filter === 'all') return rows;
	if (filter === 'active') return rows.filter((row) => row.active);
	if (filter === 'inactive') return rows.filter((row) => !row.active);
	return rows;
}

function applyStartedFilter(rows: NewClientsReportRow[], filter?: NewClientsReportStartedFilter) {
	if (!filter || filter === 'all') return rows;
	if (filter === 'started') return rows.filter((row) => row.hasStarted);
	if (filter === 'not_started') return rows.filter((row) => !row.hasStarted);
	return rows;
}

function applyTrainerFilter(rows: NewClientsReportRow[], trainerId?: number) {
	if (!trainerId) return rows;
	return rows.filter((row) => row.primaryTrainerId === trainerId);
}

function applyLocationFilter(rows: NewClientsReportRow[], locationId?: number) {
	if (!locationId) return rows;
	return rows.filter((row) => row.primaryLocationId === locationId);
}

function applySearchFilter(rows: NewClientsReportRow[], search?: string) {
	const query = normalizeSearch(search)?.toLowerCase();
	if (!query) return rows;
	return rows.filter((row) => {
		const targets = [
			row.name,
			row.firstname,
			row.lastname,
			row.email ?? '',
			row.phone ?? '',
			row.primaryTrainerName ?? '',
			row.primaryLocationName ?? ''
		];
		return targets.some((value) => value.toLowerCase().includes(query));
	});
}

function paginateRows(rows: NewClientsReportRow[], limit?: number, offset?: number) {
	const hasExplicitLimit = limit !== undefined && limit !== null;
	const sanitizedLimit = sanitizeLimit(limit);
	const start = sanitizeOffset(offset);
	if (!hasExplicitLimit) {
		if (start === 0) return rows;
		return rows.slice(start);
	}
	return rows.slice(start, start + (sanitizedLimit ?? DEFAULT_PAGE_SIZE));
}

function summarise(
	rows: NewClientsReportRow[],
	generatedAt: string,
	period: ReportPeriod
): NewClientsReportSummary {
	const total = rows.length;
	const active = rows.filter((row) => row.active).length;
	const inactive = total - active;
	const started = rows.filter((row) => row.hasStarted).length;
	const notStarted = total - started;
	const withTrialBookings = rows.filter((row) => row.trialBookings > 0).length;
	const trialBookingsTotal = rows.reduce((acc, row) => acc + row.trialBookings, 0);
	const withFirstBooking = rows.filter((row) => row.firstBookingAt !== null).length;
	const withFirstRegularBooking = rows.filter((row) => row.firstRegularBookingAt !== null).length;

	return {
		total,
		active,
		inactive,
		started,
		notStarted,
		withTrialBookings,
		trialBookingsTotal,
		withFirstBooking,
		withFirstRegularBooking,
		generatedAt,
		periodStart: period.startDate,
		periodEnd: period.endDate
	};
}

function mapRow(row: DbRow): NewClientsReportRow {
	const firstname = row.firstname?.trim() ?? '';
	const lastname = row.lastname?.trim() ?? '';
	const name = [firstname, lastname].filter(Boolean).join(' ').trim() || '(namn saknas)';
	const primaryTrainerName = [row.trainer_firstname, row.trainer_lastname]
		.map((part) => (part ?? '').trim())
		.filter(Boolean)
		.join(' ');
	const firstStartedBookingAt = toIsoString(row.first_started_booking_at);

	return {
		id: row.id,
		name,
		firstname,
		lastname,
		email: trimOrNull(row.email),
		phone: trimOrNull(row.phone),
		active: row.active === true,
		hasStarted: firstStartedBookingAt !== null,
		primaryTrainerId: row.primary_trainer_id,
		primaryTrainerName: primaryTrainerName || null,
		primaryLocationId: row.primary_location_id,
		primaryLocationName: trimOrNull(row.location_name),
		createdAt: toIsoString(row.created_at),
		firstBookingAt: toIsoString(row.first_booking_at),
		firstTrialBookingAt: toIsoString(row.first_trial_booking_at),
		firstRegularBookingAt: toIsoString(row.first_regular_booking_at),
		trialBookings: toInt(row.trial_bookings),
		regularBookings: toInt(row.regular_bookings),
		totalBookings: toInt(row.total_bookings)
	};
}

export async function getNewClientsReportRows(period: ReportPeriod): Promise<NewClientsReportRow[]> {
	const sql = `
	WITH client_base AS (
		SELECT
			c.id,
			c.firstname,
			c.lastname,
			c.email,
			c.phone,
			c.active,
			c.primary_trainer_id,
			u.firstname AS trainer_firstname,
			u.lastname AS trainer_lastname,
			c.primary_location_id,
			l.name AS location_name,
			c.created_at
		FROM clients c
		LEFT JOIN users u ON u.id = c.primary_trainer_id
		LEFT JOIN locations l ON l.id = c.primary_location_id
		WHERE c.created_at >= $1::date
			AND c.created_at < ($2::date + INTERVAL '1 day')
	),
	booking_stats AS (
		SELECT
			b.client_id,
			COUNT(*) FILTER (
				WHERE b.status IS NULL OR b.status <> $3
			) AS total_bookings,
			MIN(b.start_time) FILTER (
				WHERE b.status IS NULL OR b.status <> $3
			) AS first_booking_at,
			COUNT(*) FILTER (
				WHERE COALESCE(b.try_out, false) = true
					AND (b.status IS NULL OR b.status <> $3)
			) AS trial_bookings,
			MIN(b.start_time) FILTER (
				WHERE COALESCE(b.try_out, false) = true
					AND (b.status IS NULL OR b.status <> $3)
			) AS first_trial_booking_at,
			COUNT(*) FILTER (
				WHERE COALESCE(b.try_out, false) = false
					AND COALESCE(b.internal, false) = false
					AND COALESCE(b.education, false) = false
					AND COALESCE(b.internal_education, false) = false
					AND (b.status IS NULL OR b.status <> $3)
			) AS regular_bookings,
			MIN(b.start_time) FILTER (
				WHERE COALESCE(b.try_out, false) = false
					AND COALESCE(b.internal, false) = false
					AND COALESCE(b.education, false) = false
					AND COALESCE(b.internal_education, false) = false
					AND (b.status IS NULL OR b.status <> $3)
			) AS first_regular_booking_at,
			MIN(b.start_time) FILTER (
				WHERE COALESCE(b.try_out, false) = false
					AND COALESCE(b.internal, false) = false
					AND COALESCE(b.education, false) = false
					AND COALESCE(b.internal_education, false) = false
					AND (b.status IS NULL OR b.status <> $3)
					AND b.start_time <= NOW()
			) AS first_started_booking_at
		FROM bookings b
		WHERE b.client_id IS NOT NULL
		GROUP BY b.client_id
	)
	SELECT
		cb.id,
		cb.firstname,
		cb.lastname,
		cb.email,
		cb.phone,
		cb.active,
		cb.primary_trainer_id,
		cb.trainer_firstname,
		cb.trainer_lastname,
		cb.primary_location_id,
		cb.location_name,
		cb.created_at,
		bs.first_booking_at,
		bs.first_trial_booking_at,
		bs.first_regular_booking_at,
		bs.first_started_booking_at,
		COALESCE(bs.trial_bookings, 0) AS trial_bookings,
		COALESCE(bs.regular_bookings, 0) AS regular_bookings,
		COALESCE(bs.total_bookings, 0) AS total_bookings
	FROM client_base cb
	LEFT JOIN booking_stats bs ON bs.client_id = cb.id
	ORDER BY cb.created_at DESC NULLS LAST, LOWER(COALESCE(cb.lastname, '')), LOWER(COALESCE(cb.firstname, ''))
	`;

	const rows = (await query(sql, [period.startDate, period.endDate, CANCELLED_STATUS])) as unknown as DbRow[];
	return rows.map(mapRow);
}

async function fetchOptions(
	sql: string,
	mapper: (row: OptionRow) => NewClientsReportOption
): Promise<NewClientsReportOption[]> {
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

export async function getNewClientsReportOptions(): Promise<NewClientsReportOptions> {
	const [trainers, locations] = await Promise.all([
		fetchOptions(
			`
			SELECT DISTINCT u.id, u.firstname, u.lastname
			FROM clients c
			JOIN users u ON u.id = c.primary_trainer_id
			ORDER BY u.lastname NULLS LAST, u.firstname NULLS LAST
			`,
			mapPersonOption
		),
		fetchOptions(
			`
			SELECT DISTINCT l.id, l.name
			FROM clients c
			JOIN locations l ON l.id = c.primary_location_id
			ORDER BY l.name NULLS LAST
			`,
			mapNameOption
		)
	]);

	return { trainers, locations };
}

export async function getNewClientsReport(
	filters: NewClientsReportFilters = {}
): Promise<NewClientsReport> {
	const period = resolvePeriod(filters);
	const generatedAt = new Date().toISOString();
	const allRows = await getNewClientsReportRows(period);
	const summary = summarise(allRows, generatedAt, period);
	const activeFiltered = applyActiveFilter(allRows, filters.active);
	const startedFiltered = applyStartedFilter(activeFiltered, filters.started);
	const trainerFiltered = applyTrainerFilter(startedFiltered, filters.trainerId);
	const locationFiltered = applyLocationFilter(trainerFiltered, filters.locationId);
	const filteredSummary = summarise(locationFiltered, generatedAt, period);
	const searchFiltered = applySearchFilter(locationFiltered, filters.search);
	const paginatedRows = paginateRows(searchFiltered, filters.limit, filters.offset);

	return {
		rows: paginatedRows,
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

function createFilename(filters: NewClientsReportFilters, generatedAt: string, period: ReportPeriod) {
	const now = new Date(generatedAt);
	const datePart = now.toISOString().slice(0, 10);
	const timePart = now.toISOString().slice(11, 16).replace(':', '');
	const activeSuffix =
		filters.active === 'active' ? 'aktiva' : filters.active === 'inactive' ? 'inaktiva' : 'alla';
	const startedSuffix =
		filters.started === 'started'
			? 'startade'
			: filters.started === 'not_started'
				? 'ej_startade'
				: 'startstatus_alla';
	return `new_clients_report_${activeSuffix}_${startedSuffix}_${period.startDate}_${period.endDate}_${datePart}_${timePart}.xlsx`;
}

export async function buildNewClientsReportWorkbook(filters: NewClientsReportFilters = {}) {
	const generatedAt = new Date().toISOString();
	const period = resolvePeriod(filters);
	const allRows = await getNewClientsReportRows(period);
	const activeFiltered = applyActiveFilter(allRows, filters.active);
	const startedFiltered = applyStartedFilter(activeFiltered, filters.started);
	const trainerFiltered = applyTrainerFilter(startedFiltered, filters.trainerId);
	const locationFiltered = applyLocationFilter(trainerFiltered, filters.locationId);
	const rows = applySearchFilter(locationFiltered, filters.search);

	const workbook = await createWorkbook();
	const worksheet = workbook.addWorksheet('Nya klienter');

	worksheet.addRow([
		'Namn',
		'Aktiv',
		'Har börjat',
		'Primär tränare',
		'Primär studio',
		'Skapad',
		'Provbokningar',
		'Första provbokning',
		'Första bokning',
		'Första träning',
		'Totala bokningar',
		'Vanliga bokningar',
		'E-post',
		'Telefon'
	]);
	worksheet.getRow(1).font = { bold: true };

	for (const row of rows) {
		worksheet.addRow([
			row.name,
			formatBoolean(row.active),
			formatBoolean(row.hasStarted),
			row.primaryTrainerName ?? '',
			row.primaryLocationName ?? '',
			asDate(row.createdAt),
			row.trialBookings,
			asDate(row.firstTrialBookingAt),
			asDate(row.firstBookingAt),
			asDate(row.firstRegularBookingAt),
			row.totalBookings,
			row.regularBookings,
			row.email ?? '',
			row.phone ?? ''
		]);
	}

	const numericColumns = [7, 11, 12];
	for (const colIndex of numericColumns) {
		worksheet.getColumn(colIndex).numFmt = '0';
	}

	const dateColumns = [6, 8, 9, 10];
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
			acc.trialBookings += row.trialBookings;
			acc.totalBookings += row.totalBookings;
			acc.regularBookings += row.regularBookings;
			acc.started += row.hasStarted ? 1 : 0;
			return acc;
		},
		{ trialBookings: 0, totalBookings: 0, regularBookings: 0, started: 0 }
	);

	totalsRow.getCell(3).value = `${aggregate.started} startade`;
	totalsRow.getCell(7).value = aggregate.trialBookings;
	totalsRow.getCell(11).value = aggregate.totalBookings;
	totalsRow.getCell(12).value = aggregate.regularBookings;

	const rawBuffer = await workbook.xlsx.writeBuffer();
	const buffer =
		rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer as ArrayBuffer);
	const filename = createFilename(filters, generatedAt, period);

	return { buffer, filename };
}
