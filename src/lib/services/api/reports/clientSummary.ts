import { query } from '$lib/db';

const LATE_CANCEL_STATES = ['Late_cancelled'];
const HARD_CANCEL_STATES = ['Cancelled'];

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

type ReportPeriod = {
	startDate: string;
	endDate: string;
};

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

function toDateKey(value: string | null) {
	if (!value) return null;
	if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}

function isDateKeyInPeriod(dateKey: string | null, period: ReportPeriod) {
	if (!dateKey) return false;
	return dateKey >= period.startDate && dateKey <= period.endDate;
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

function resolvePeriod(filters: ClientReportFilters): ReportPeriod {
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
	primary_location_id: number | null;
	location_name: string | null;
	created_at: string | null;
	updated_at: string | null;
	total_bookings: number | null;
	bookings_last_90_days: number | null;
	bookings_last_30_days: number | null;
	bookings_in_period: number | null;
	late_cancelled_last_90_days: number | null;
	late_cancelled_last_30_days: number | null;
	late_cancelled_in_period: number | null;
	cancelled_last_90_days: number | null;
	cancelled_last_30_days: number | null;
	cancelled_in_period: number | null;
	first_booking_at: string | null;
	last_booking_at: string | null;
	next_booking_at: string | null;
	package_count: number | null;
	active_packages: number | null;
	total_sessions: number | null;
	used_sessions: number | null;
	remaining_sessions: number | null;
	total_package_value: number | null;
	customers: Array<{ id?: number; name?: string } | null> | null;
};

export type CustomerLink = {
	id: number;
	name: string;
};

export type ClientReportRow = {
	id: number;
	name: string;
	firstname: string;
	lastname: string;
	email: string | null;
	phone: string | null;
	active: boolean;
	primaryTrainerId: number | null;
	primaryTrainerName: string | null;
	primaryLocationId: number | null;
	primaryLocationName: string | null;
	totalBookings: number;
	bookingsLast90Days: number;
	bookingsLast30Days: number;
	bookingsInPeriod: number;
	lateCancelledLast90Days: number;
	lateCancelledLast30Days: number;
	lateCancelledInPeriod: number;
	cancelledLast90Days: number;
	cancelledLast30Days: number;
	cancelledInPeriod: number;
	firstBookingAt: string | null;
	lastBookingAt: string | null;
	nextBookingAt: string | null;
	packageCount: number;
	activePackages: number;
	totalSessions: number;
	usedSessions: number;
	remainingSessions: number;
	totalPackageValue: number;
	customers: CustomerLink[];
	createdAt: string | null;
	updatedAt: string | null;
};

export type ClientReportSummary = {
	total: number;
	active: number;
	inactive: number;
	activeWithRecentBooking: number;
	activeWithBookingInPeriod: number;
	clientsWithBookingInPeriod: number;
	bookingsInPeriod: number;
	lateCancelledInPeriod: number;
	cancelledInPeriod: number;
	newClientsInPeriod: number;
	generatedAt: string;
	periodStart: string;
	periodEnd: string;
	lateCancelledLast90Days: number;
	lateCancelledLast30Days: number;
	cancelledLast90Days: number;
	cancelledLast30Days: number;
};

export type ClientReportFilters = {
	active?: 'all' | 'active' | 'inactive';
	search?: string;
	trainerId?: number;
	locationId?: number;
	dateFrom?: string;
	dateTo?: string;
	limit?: number;
	offset?: number;
};

export type ClientReport = {
	rows: ClientReportRow[];
	summary: ClientReportSummary;
	filteredSummary: ClientReportSummary;
};

export type ClientReportOption = {
	id: number;
	label: string;
};

export type ClientReportOptions = {
	trainers: ClientReportOption[];
	locations: ClientReportOption[];
};

function cleanCustomers(customers: DbRow['customers']): CustomerLink[] {
	if (!Array.isArray(customers)) return [];
	return customers
		.filter(
			(value): value is { id?: number; name?: string } =>
				value !== null && typeof value === 'object'
		)
		.map((value) => {
			const id = typeof value.id === 'number' && Number.isFinite(value.id) ? value.id : null;
			const name = typeof value.name === 'string' ? value.name.trim() : '';
			if (id === null || !name) return null;
			return { id, name } as CustomerLink;
		})
		.filter((value): value is CustomerLink => value !== null);
}

function applyActiveFilter(rows: ClientReportRow[], filter: ClientReportFilters['active']) {
	if (!filter || filter === 'all') return rows;
	if (filter === 'active') return rows.filter((row) => row.active);
	if (filter === 'inactive') return rows.filter((row) => !row.active);
	return rows;
}

function applyTrainerFilter(rows: ClientReportRow[], trainerId?: number) {
	if (!trainerId) return rows;
	return rows.filter((row) => row.primaryTrainerId === trainerId);
}

function applyLocationFilter(rows: ClientReportRow[], locationId?: number) {
	if (!locationId) return rows;
	return rows.filter((row) => row.primaryLocationId === locationId);
}

function applySearchFilter(rows: ClientReportRow[], search?: string) {
	const query = normalizeSearch(search)?.toLowerCase();
	if (!query) return rows;
	return rows.filter((row) => {
		const targets: string[] = [
			row.name,
			row.firstname,
			row.lastname,
			row.email ?? '',
			row.primaryTrainerName ?? '',
			row.primaryLocationName ?? '',
			...row.customers.map((customer) => customer.name)
		].filter(Boolean);
		return targets.some((value) => value.toLowerCase().includes(query));
	});
}

function sanitizeLimit(limit?: number) {
	if (limit === undefined || limit === null) return undefined;
	const parsed = Math.trunc(Number(limit));
	if (!Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE;
	if (parsed <= 0) return DEFAULT_PAGE_SIZE;
	return Math.min(parsed, MAX_PAGE_SIZE);
}

function sanitizeOffset(offset?: number) {
	if (offset === undefined || offset === null) return 0;
	const parsed = Math.trunc(Number(offset));
	if (!Number.isFinite(parsed) || parsed < 0) return 0;
	return parsed;
}

function paginateRows(rows: ClientReportRow[], limit?: number, offset?: number) {
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
	rows: ClientReportRow[],
	generatedAt: string,
	period: ReportPeriod
): ClientReportSummary {
	const total = rows.length;
	const active = rows.filter((row) => row.active).length;
	const inactive = total - active;
	const activeWithRecentBooking = rows.filter((row) => row.active && row.bookingsLast90Days > 0).length;
	const activeWithBookingInPeriod = rows.filter((row) => row.active && row.bookingsInPeriod > 0).length;
	const clientsWithBookingInPeriod = rows.filter((row) => row.bookingsInPeriod > 0).length;
	const bookingsInPeriod = rows.reduce((acc, row) => acc + row.bookingsInPeriod, 0);
	const lateCancelledInPeriod = rows.reduce((acc, row) => acc + row.lateCancelledInPeriod, 0);
	const cancelledInPeriod = rows.reduce((acc, row) => acc + row.cancelledInPeriod, 0);
	const lateCancelledLast90Days = rows.reduce((acc, row) => acc + row.lateCancelledLast90Days, 0);
	const lateCancelledLast30Days = rows.reduce((acc, row) => acc + row.lateCancelledLast30Days, 0);
	const cancelledLast90Days = rows.reduce((acc, row) => acc + row.cancelledLast90Days, 0);
	const cancelledLast30Days = rows.reduce((acc, row) => acc + row.cancelledLast30Days, 0);
	const newClientsInPeriod = rows.filter((row) => isDateKeyInPeriod(toDateKey(row.createdAt), period)).length;

	return {
		total,
		active,
		inactive,
		activeWithRecentBooking,
		activeWithBookingInPeriod,
		clientsWithBookingInPeriod,
		bookingsInPeriod,
		lateCancelledInPeriod,
		cancelledInPeriod,
		newClientsInPeriod,
		generatedAt,
		periodStart: period.startDate,
		periodEnd: period.endDate,
		lateCancelledLast90Days,
		lateCancelledLast30Days,
		cancelledLast90Days,
		cancelledLast30Days
	};
}

export async function getClientReportRows(period: ReportPeriod): Promise<ClientReportRow[]> {
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
			c.primary_location_id,
			l.name AS location_name,
			c.created_at,
			c.updated_at
		FROM clients c
		LEFT JOIN users u ON u.id = c.primary_trainer_id
		LEFT JOIN locations l ON l.id = c.primary_location_id
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
	cancellation_stats AS (
		SELECT
			b.client_id,
			COUNT(*) FILTER (
				WHERE b.status = ANY($1)
					AND b.start_time >= (NOW() - INTERVAL '90 days')
			) AS late_cancelled_last_90_days,
			COUNT(*) FILTER (
				WHERE b.status = ANY($1)
					AND b.start_time >= (NOW() - INTERVAL '30 days')
			) AS late_cancelled_last_30_days,
			COUNT(*) FILTER (
				WHERE b.status = ANY($1)
					AND b.start_time >= $3::date
					AND b.start_time < ($4::date + INTERVAL '1 day')
			) AS late_cancelled_in_period,
			COUNT(*) FILTER (
				WHERE b.status = ANY($2)
					AND b.start_time >= (NOW() - INTERVAL '90 days')
			) AS cancelled_last_90_days,
			COUNT(*) FILTER (
				WHERE b.status = ANY($2)
					AND b.start_time >= (NOW() - INTERVAL '30 days')
			) AS cancelled_last_30_days,
			COUNT(*) FILTER (
				WHERE b.status = ANY($2)
					AND b.start_time >= $3::date
					AND b.start_time < ($4::date + INTERVAL '1 day')
			) AS cancelled_in_period
		FROM bookings b
		WHERE b.client_id IS NOT NULL
			AND COALESCE(b.try_out, false) = false
		GROUP BY b.client_id
	),
	booking_stats AS (
		SELECT
			fb.client_id,
			COUNT(*) AS total_bookings,
			COUNT(*) FILTER (WHERE fb.start_time >= (NOW() - INTERVAL '90 days')) AS bookings_last_90_days,
			COUNT(*) FILTER (WHERE fb.start_time >= (NOW() - INTERVAL '30 days')) AS bookings_last_30_days,
			COUNT(*) FILTER (
				WHERE fb.start_time >= $3::date
					AND fb.start_time < ($4::date + INTERVAL '1 day')
			) AS bookings_in_period,
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
			client_id,
			JSONB_AGG(customer ORDER BY customer->>'name') AS customers
		FROM (
			SELECT DISTINCT
				ccr.client_id,
				jsonb_build_object('id', cu.id, 'name', cu.name) AS customer
			FROM client_customer_relationships ccr
			JOIN customers cu ON cu.id = ccr.customer_id
			WHERE COALESCE(ccr.active, true) = true
		) dedup
		GROUP BY client_id
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
		cb.primary_location_id,
		cb.location_name,
		cb.created_at,
		cb.updated_at,
		COALESCE(bs.total_bookings, 0) AS total_bookings,
		COALESCE(bs.bookings_last_90_days, 0) AS bookings_last_90_days,
		COALESCE(bs.bookings_last_30_days, 0) AS bookings_last_30_days,
		COALESCE(bs.bookings_in_period, 0) AS bookings_in_period,
		bs.first_booking_at,
		bs.last_booking_at,
		bs.next_booking_at,
		COALESCE(ps.package_count, 0) AS package_count,
		COALESCE(ps.active_packages, 0) AS active_packages,
		COALESCE(ps.total_sessions, 0) AS total_sessions,
		COALESCE(pu.used_sessions, 0) AS used_sessions,
		COALESCE(ps.total_sessions, 0) - COALESCE(pu.used_sessions, 0) AS remaining_sessions,
		COALESCE(ps.total_package_value, 0) AS total_package_value,
		COALESCE(cl.customers, '[]'::jsonb) AS customers,
		COALESCE(cs.late_cancelled_last_90_days, 0) AS late_cancelled_last_90_days,
		COALESCE(cs.late_cancelled_last_30_days, 0) AS late_cancelled_last_30_days,
		COALESCE(cs.late_cancelled_in_period, 0) AS late_cancelled_in_period,
		COALESCE(cs.cancelled_last_90_days, 0) AS cancelled_last_90_days,
		COALESCE(cs.cancelled_last_30_days, 0) AS cancelled_last_30_days,
		COALESCE(cs.cancelled_in_period, 0) AS cancelled_in_period
	FROM client_base cb
	LEFT JOIN booking_stats bs ON bs.client_id = cb.id
	LEFT JOIN package_stats ps ON ps.client_id = cb.id
	LEFT JOIN package_usage pu ON pu.client_id = cb.id
	LEFT JOIN customer_links cl ON cl.client_id = cb.id
	LEFT JOIN cancellation_stats cs ON cs.client_id = cb.id
	ORDER BY LOWER(COALESCE(cb.lastname, '')), LOWER(COALESCE(cb.firstname, ''))
	`;

	const rows = (await query(sql, [
		LATE_CANCEL_STATES,
		HARD_CANCEL_STATES,
		period.startDate,
		period.endDate
	])) as unknown as DbRow[];

	return rows.map((row) => {
		const firstname = row.firstname?.trim() ?? '';
		const lastname = row.lastname?.trim() ?? '';
		const name = [firstname, lastname].filter(Boolean).join(' ').trim() || '(namn saknas)';
		const totalSessions = Math.max(0, toInt(row.total_sessions));
		const usedSessions = Math.max(0, Math.min(totalSessions, toInt(row.used_sessions)));
		const remainingSessions = Math.max(0, totalSessions - usedSessions);

		const primaryTrainerName = [row.trainer_firstname, row.trainer_lastname]
			.map((part) => (part ?? '').trim())
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
			primaryTrainerId: row.primary_trainer_id,
			primaryTrainerName: primaryTrainerName || null,
			primaryLocationId: row.primary_location_id,
			primaryLocationName: trimOrNull(row.location_name),
			totalBookings: toInt(row.total_bookings),
			bookingsLast90Days: toInt(row.bookings_last_90_days),
			bookingsLast30Days: toInt(row.bookings_last_30_days),
			bookingsInPeriod: toInt(row.bookings_in_period),
			lateCancelledLast90Days: toInt(row.late_cancelled_last_90_days),
			lateCancelledLast30Days: toInt(row.late_cancelled_last_30_days),
			lateCancelledInPeriod: toInt(row.late_cancelled_in_period),
			cancelledLast90Days: toInt(row.cancelled_last_90_days),
			cancelledLast30Days: toInt(row.cancelled_last_30_days),
			cancelledInPeriod: toInt(row.cancelled_in_period),
			firstBookingAt: toIsoString(row.first_booking_at),
			lastBookingAt: toIsoString(row.last_booking_at),
			nextBookingAt: toIsoString(row.next_booking_at),
			packageCount: toInt(row.package_count),
			activePackages: toInt(row.active_packages),
			totalSessions,
			usedSessions,
			remainingSessions,
			totalPackageValue: toNumber(row.total_package_value),
			customers: cleanCustomers(row.customers),
			createdAt: toIsoString(row.created_at),
			updatedAt: toIsoString(row.updated_at)
		};
	});
}

type OptionRow = {
	id: number;
	firstname?: string | null;
	lastname?: string | null;
	name?: string | null;
};

async function fetchOptions(
	sql: string,
	mapper: (row: OptionRow) => ClientReportOption
): Promise<ClientReportOption[]> {
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

export async function getClientReportOptions(): Promise<ClientReportOptions> {
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

export async function getClientReport(filters: ClientReportFilters = {}): Promise<ClientReport> {
	const period = resolvePeriod(filters);
	const generatedAt = new Date().toISOString();
	const allRows = await getClientReportRows(period);
	const summary = summarise(allRows, generatedAt, period);
	const activeFiltered = applyActiveFilter(allRows, filters.active);
	const trainerFiltered = applyTrainerFilter(activeFiltered, filters.trainerId);
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

function formatCustomers(customers: CustomerLink[]) {
	return customers.map((customer) => customer.name).join(', ');
}

function createFilename(filters: ClientReportFilters, generatedAt: string, period: ReportPeriod) {
	const now = new Date(generatedAt);
	const datePart = now.toISOString().slice(0, 10);
	const timePart = now.toISOString().slice(11, 16).replace(':', '');
	const activeSuffix =
		filters.active === 'active' ? 'aktiva' : filters.active === 'inactive' ? 'inaktiva' : 'alla';
	const trainerSuffix = filters.trainerId ? `trainer_${filters.trainerId}` : 'alla_tranare';
	const locationSuffix = filters.locationId ? `studio_${filters.locationId}` : 'alla_studios';
	return `client_report_${activeSuffix}_${trainerSuffix}_${locationSuffix}_${period.startDate}_${period.endDate}_${datePart}_${timePart}.xlsx`;
}

export async function buildClientReportWorkbook(filters: ClientReportFilters = {}) {
	const generatedAt = new Date().toISOString();
	const period = resolvePeriod(filters);
	const allRows = await getClientReportRows(period);
	const activeFiltered = applyActiveFilter(allRows, filters.active);
	const trainerFiltered = applyTrainerFilter(activeFiltered, filters.trainerId);
	const locationFiltered = applyLocationFilter(trainerFiltered, filters.locationId);
	const rows = applySearchFilter(locationFiltered, filters.search);

	const workbook = await createWorkbook();
	const worksheet = workbook.addWorksheet('Klienter');
	const periodLabel = `${period.startDate} - ${period.endDate}`;

	worksheet.addRow([
		'Namn',
		'Aktiv',
		'Primär tränare',
		'Primär studio',
		'E-post',
		'Telefon',
		'Totala bokningar',
		`Bokningar ${periodLabel}`,
		'Bokningar 90 dagar',
		'Bokningar 30 dagar',
		`Sen avbokning ${periodLabel}`,
		'Sen avbokning 90 dagar',
		'Sen avbokning 30 dagar',
		`Avbokningar ${periodLabel}`,
		'Avbokningar 90 dagar',
		'Avbokningar 30 dagar',
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
			row.primaryTrainerName ?? '',
			row.primaryLocationName ?? '',
			row.email ?? '',
			row.phone ?? '',
			row.totalBookings,
			row.bookingsInPeriod,
			row.bookingsLast90Days,
			row.bookingsLast30Days,
			row.lateCancelledInPeriod,
			row.lateCancelledLast90Days,
			row.lateCancelledLast30Days,
			row.cancelledInPeriod,
			row.cancelledLast90Days,
			row.cancelledLast30Days,
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

	const numericColumns = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 21, 22, 23, 24];
	for (const colIndex of numericColumns) {
		worksheet.getColumn(colIndex).numFmt = '0';
	}
	worksheet.getColumn(25).numFmt = '#,##0.00';

	const dateColumns = [17, 18, 19, 27, 28];
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
			acc.bookingsInPeriod += row.bookingsInPeriod;
			acc.bookings90 += row.bookingsLast90Days;
			acc.bookings30 += row.bookingsLast30Days;
			acc.lateCancelledInPeriod += row.lateCancelledInPeriod;
			acc.lateCancelled90 += row.lateCancelledLast90Days;
			acc.lateCancelled30 += row.lateCancelledLast30Days;
			acc.cancelledInPeriod += row.cancelledInPeriod;
			acc.cancelled90 += row.cancelledLast90Days;
			acc.cancelled30 += row.cancelledLast30Days;
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
			bookingsInPeriod: 0,
			bookings90: 0,
			bookings30: 0,
			lateCancelledInPeriod: 0,
			lateCancelled90: 0,
			lateCancelled30: 0,
			cancelledInPeriod: 0,
			cancelled90: 0,
			cancelled30: 0,
			totalPackages: 0,
			activePackages: 0,
			totalSessions: 0,
			usedSessions: 0,
			remainingSessions: 0,
			totalValue: 0
		}
	);

	totalsRow.getCell(7).value = aggregate.totalBookings;
	totalsRow.getCell(8).value = aggregate.bookingsInPeriod;
	totalsRow.getCell(9).value = aggregate.bookings90;
	totalsRow.getCell(10).value = aggregate.bookings30;
	totalsRow.getCell(11).value = aggregate.lateCancelledInPeriod;
	totalsRow.getCell(12).value = aggregate.lateCancelled90;
	totalsRow.getCell(13).value = aggregate.lateCancelled30;
	totalsRow.getCell(14).value = aggregate.cancelledInPeriod;
	totalsRow.getCell(15).value = aggregate.cancelled90;
	totalsRow.getCell(16).value = aggregate.cancelled30;
	totalsRow.getCell(20).value = aggregate.totalPackages;
	totalsRow.getCell(21).value = aggregate.activePackages;
	totalsRow.getCell(22).value = aggregate.totalSessions;
	totalsRow.getCell(23).value = aggregate.usedSessions;
	totalsRow.getCell(24).value = aggregate.remainingSessions;
	totalsRow.getCell(25).value = aggregate.totalValue;
	totalsRow.getCell(25).numFmt = '#,##0.00';

	const rawBuffer = await workbook.xlsx.writeBuffer();
	const buffer =
		rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer as ArrayBuffer);
	const filename = createFilename(filters, generatedAt, period);

	return { buffer, filename };
}
