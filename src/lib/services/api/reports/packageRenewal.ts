import { query } from '$lib/db';
import { CANCELLED_STATUS, packageFreeExclusionSql } from '$lib/server/packageSemantics';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const DEFAULT_NEAR_FULL_THRESHOLD = 3;
const DEFAULT_CLOSE_TO_LAST_BOOKING_DAYS = 30;

export type PackageRenewalPriorityFilter = 'attention' | 'urgent' | 'watch' | 'ok' | 'all';
export type PackageRenewalCapacityFilter = 'all' | 'full' | 'near_full' | 'open';
export type PackageRenewalClientFilter = 'all' | 'active' | 'inactive';
export type PackageRenewalFrozenFilter = 'exclude_frozen' | 'all' | 'only_frozen';

export type PackageRenewalFilters = {
	priority?: PackageRenewalPriorityFilter;
	capacity?: PackageRenewalCapacityFilter;
	client?: PackageRenewalClientFilter;
	frozen?: PackageRenewalFrozenFilter;
	trainerId?: number;
	locationId?: number;
	nearFullThreshold?: number;
	closeToLastBookingDays?: number;
	search?: string;
	limit?: number;
	offset?: number;
};

type DbRow = {
	package_id: number;
	client_id: number | null;
	customer_id: number | null;
	article_id: number | null;
	paid_price: string | number | null;
	first_payment_date: string | null;
	frozen_from_date: string | null;
	autogiro: boolean | null;
	created_at: string | null;
	article_name: string | null;
	total_sessions: number | null;
	customer_name: string | null;
	customer_no: string | null;
	client_name: string | null;
	client_active: boolean | null;
	primary_trainer_id: number | null;
	trainer_name: string | null;
	primary_location_id: number | null;
	location_name: string | null;
	booked_total: number | string | null;
	booked_passed: number | string | null;
	booked_future: number | string | null;
	first_booking_at: string | null;
	last_booking_at: string | null;
	last_passed_booking_at: string | null;
	next_booking_at: string | null;
};

type OptionRow = {
	id: number;
	firstname?: string | null;
	lastname?: string | null;
	name?: string | null;
};

export type PackageRenewalRow = {
	packageId: number;
	clientId: number | null;
	customerId: number | null;
	articleId: number | null;
	articleName: string | null;
	totalSessions: number;
	bookedTotal: number;
	bookedPassed: number;
	bookedFuture: number;
	remainingByBooked: number;
	remainingByPassed: number;
	firstBookingAt: string | null;
	lastBookingAt: string | null;
	lastPassedBookingAt: string | null;
	nextBookingAt: string | null;
	daysToLastBooking: number | null;
	isFullBooked: boolean;
	isNearFull: boolean;
	isFrozen: boolean;
	priority: 'urgent' | 'watch' | 'ok';
	priorityLabel: string;
	urgencyReason: string;
	clientName: string | null;
	clientActive: boolean | null;
	customerName: string | null;
	customerNo: string | null;
	primaryTrainerId: number | null;
	primaryTrainerName: string | null;
	primaryLocationId: number | null;
	primaryLocationName: string | null;
	paidPrice: number | null;
	firstPaymentDate: string | null;
	frozenFromDate: string | null;
	autogiro: boolean;
	createdAt: string | null;
};

export type PackageRenewalSummary = {
	total: number;
	urgent: number;
	watch: number;
	ok: number;
	fullBooked: number;
	nearFull: number;
	frozen: number;
	activeClient: number;
	inactiveClient: number;
	withoutClient: number;
	avgRemainingByBooked: number;
	avgRemainingByPassed: number;
	generatedAt: string;
};

export type PackageRenewalReport = {
	rows: PackageRenewalRow[];
	summary: PackageRenewalSummary;
	filteredSummary: PackageRenewalSummary;
};

export type PackageRenewalOption = {
	id: number;
	label: string;
};

export type PackageRenewalOptions = {
	trainers: PackageRenewalOption[];
	locations: PackageRenewalOption[];
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

function sanitizeThreshold(value: number | undefined, fallback: number, min: number, max: number) {
	if (value === undefined || value === null) return fallback;
	const parsed = Math.trunc(Number(value));
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(Math.max(parsed, min), max);
}

function clampCount(value: number, total: number) {
	if (!Number.isFinite(value)) return 0;
	if (value < 0) return 0;
	return Math.min(value, total);
}

function msFromDate(value: string | null) {
	if (!value) return null;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date.getTime();
}

function daysBetween(isoDate: string | null) {
	const ms = msFromDate(isoDate);
	if (ms === null) return null;
	const now = Date.now();
	const dayMs = 24 * 60 * 60 * 1000;
	return Math.ceil((ms - now) / dayMs);
}

function isFrozenNow(frozenFromDate: string | null) {
	const ms = msFromDate(frozenFromDate);
	if (ms === null) return false;
	return ms <= Date.now();
}

function derivePriority(
	row: Pick<
		PackageRenewalRow,
		'remainingByBooked' | 'remainingByPassed' | 'isFullBooked' | 'daysToLastBooking'
	>,
	nearFullThreshold: number,
	closeToLastBookingDays: number
): Pick<PackageRenewalRow, 'priority' | 'priorityLabel' | 'urgencyReason'> {
	const closeToLastBooking =
		row.daysToLastBooking !== null && row.daysToLastBooking <= closeToLastBookingDays;

	if (row.remainingByPassed <= nearFullThreshold) {
		const remaining = Math.max(row.remainingByPassed, 0);
		return {
			priority: 'urgent',
			priorityLabel: 'Akut',
			urgencyReason: `Endast ${remaining} pass kvar att genomföra.`
		};
	}

	if (row.isFullBooked && closeToLastBooking) {
		return {
			priority: 'urgent',
			priorityLabel: 'Akut',
			urgencyReason: 'Fullbokat och nära sista bokning.'
		};
	}

	if (row.isFullBooked) {
		return {
			priority: 'watch',
			priorityLabel: 'Bevaka',
			urgencyReason: 'Fullbokat men sista bokning ligger längre fram.'
		};
	}

	if (row.remainingByBooked <= nearFullThreshold) {
		return {
			priority: 'watch',
			priorityLabel: 'Bevaka',
			urgencyReason: `Bara ${row.remainingByBooked} pass kvar att boka.`
		};
	}

	return {
		priority: 'ok',
		priorityLabel: 'OK',
		urgencyReason: 'Tillräcklig marginal just nu.'
	};
}

function mapRow(
	row: DbRow,
	nearFullThreshold: number,
	closeToLastBookingDays: number
): PackageRenewalRow {
	const totalSessions = Math.max(0, toInt(row.total_sessions));
	const bookedTotal = clampCount(toInt(row.booked_total), totalSessions || Number.MAX_SAFE_INTEGER);
	const bookedPassed = clampCount(toInt(row.booked_passed), totalSessions || Number.MAX_SAFE_INTEGER);
	const bookedFuture = clampCount(toInt(row.booked_future), totalSessions || Number.MAX_SAFE_INTEGER);
	const remainingByBooked = Math.max(totalSessions - bookedTotal, 0);
	const remainingByPassed = Math.max(totalSessions - bookedPassed, 0);
	const isFullBooked = totalSessions > 0 && remainingByBooked === 0;
	const isNearFull = totalSessions > 0 && remainingByBooked > 0 && remainingByBooked <= nearFullThreshold;
	const lastBookingAt = toIsoString(row.last_booking_at);
	const derived = derivePriority(
		{
			remainingByBooked,
			remainingByPassed,
			isFullBooked,
			daysToLastBooking: daysBetween(lastBookingAt)
		},
		nearFullThreshold,
		closeToLastBookingDays
	);

	return {
		packageId: toInt(row.package_id),
		clientId: row.client_id,
		customerId: row.customer_id,
		articleId: row.article_id,
		articleName: trimOrNull(row.article_name),
		totalSessions,
		bookedTotal,
		bookedPassed,
		bookedFuture,
		remainingByBooked,
		remainingByPassed,
		firstBookingAt: toIsoString(row.first_booking_at),
		lastBookingAt,
		lastPassedBookingAt: toIsoString(row.last_passed_booking_at),
		nextBookingAt: toIsoString(row.next_booking_at),
		daysToLastBooking: daysBetween(lastBookingAt),
		isFullBooked,
		isNearFull,
		isFrozen: isFrozenNow(toIsoString(row.frozen_from_date)),
		priority: derived.priority,
		priorityLabel: derived.priorityLabel,
		urgencyReason: derived.urgencyReason,
		clientName: trimOrNull(row.client_name),
		clientActive: row.client_active === null ? null : row.client_active === true,
		customerName: trimOrNull(row.customer_name),
		customerNo: trimOrNull(row.customer_no),
		primaryTrainerId: row.primary_trainer_id,
		primaryTrainerName: trimOrNull(row.trainer_name),
		primaryLocationId: row.primary_location_id,
		primaryLocationName: trimOrNull(row.location_name),
		paidPrice: toNumber(row.paid_price),
		firstPaymentDate: toIsoString(row.first_payment_date),
		frozenFromDate: toIsoString(row.frozen_from_date),
		autogiro: row.autogiro === true,
		createdAt: toIsoString(row.created_at)
	};
}

function applyPriorityFilter(rows: PackageRenewalRow[], filter: PackageRenewalPriorityFilter) {
	if (!filter || filter === 'all') return rows;
	if (filter === 'attention') return rows.filter((row) => row.priority === 'urgent' || row.priority === 'watch');
	return rows.filter((row) => row.priority === filter);
}

function applyCapacityFilter(rows: PackageRenewalRow[], filter: PackageRenewalCapacityFilter) {
	if (!filter || filter === 'all') return rows;
	if (filter === 'full') return rows.filter((row) => row.isFullBooked);
	if (filter === 'near_full') return rows.filter((row) => row.isNearFull);
	if (filter === 'open') return rows.filter((row) => !row.isFullBooked && !row.isNearFull);
	return rows;
}

function applyClientFilter(rows: PackageRenewalRow[], filter: PackageRenewalClientFilter) {
	if (!filter || filter === 'all') return rows;
	if (filter === 'active') return rows.filter((row) => row.clientActive === true);
	if (filter === 'inactive') return rows.filter((row) => row.clientActive === false);
	return rows;
}

function applyFrozenFilter(rows: PackageRenewalRow[], filter: PackageRenewalFrozenFilter) {
	if (!filter || filter === 'all') return rows;
	if (filter === 'exclude_frozen') return rows.filter((row) => !row.isFrozen);
	if (filter === 'only_frozen') return rows.filter((row) => row.isFrozen);
	return rows;
}

function applyTrainerFilter(rows: PackageRenewalRow[], trainerId?: number) {
	if (!trainerId) return rows;
	return rows.filter((row) => row.primaryTrainerId === trainerId);
}

function applyLocationFilter(rows: PackageRenewalRow[], locationId?: number) {
	if (!locationId) return rows;
	return rows.filter((row) => row.primaryLocationId === locationId);
}

function applySearchFilter(rows: PackageRenewalRow[], search?: string) {
	const query = normalizeSearch(search)?.toLowerCase();
	if (!query) return rows;
	return rows.filter((row) => {
		const targets = [
			String(row.packageId),
			row.clientName ?? '',
			row.customerName ?? '',
			row.customerNo ?? '',
			row.articleName ?? '',
			row.primaryTrainerName ?? '',
			row.primaryLocationName ?? '',
			row.priorityLabel,
			row.urgencyReason
		];
		return targets.some((value) => value.toLowerCase().includes(query));
	});
}

function sortRows(rows: PackageRenewalRow[]) {
	const priorityRank: Record<PackageRenewalRow['priority'], number> = {
		urgent: 0,
		watch: 1,
		ok: 2
	};

	return [...rows].sort((a, b) => {
		const p = priorityRank[a.priority] - priorityRank[b.priority];
		if (p !== 0) return p;

		if (a.remainingByBooked !== b.remainingByBooked) {
			return a.remainingByBooked - b.remainingByBooked;
		}

		if (a.daysToLastBooking !== null && b.daysToLastBooking !== null && a.daysToLastBooking !== b.daysToLastBooking) {
			return a.daysToLastBooking - b.daysToLastBooking;
		}

		if (a.daysToLastBooking === null && b.daysToLastBooking !== null) return 1;
		if (a.daysToLastBooking !== null && b.daysToLastBooking === null) return -1;

		return b.packageId - a.packageId;
	});
}

function paginateRows(rows: PackageRenewalRow[], limit?: number, offset?: number) {
	const hasExplicitLimit = limit !== undefined && limit !== null;
	const sanitizedLimit = sanitizeLimit(limit);
	const start = sanitizeOffset(offset);
	if (!hasExplicitLimit) {
		if (start === 0) return rows;
		return rows.slice(start);
	}
	return rows.slice(start, start + (sanitizedLimit ?? DEFAULT_PAGE_SIZE));
}

function summarize(rows: PackageRenewalRow[], generatedAt: string): PackageRenewalSummary {
	const total = rows.length;
	const urgent = rows.filter((row) => row.priority === 'urgent').length;
	const watch = rows.filter((row) => row.priority === 'watch').length;
	const ok = total - urgent - watch;
	const fullBooked = rows.filter((row) => row.isFullBooked).length;
	const nearFull = rows.filter((row) => row.isNearFull).length;
	const frozen = rows.filter((row) => row.isFrozen).length;
	const activeClient = rows.filter((row) => row.clientActive === true).length;
	const inactiveClient = rows.filter((row) => row.clientActive === false).length;
	const withoutClient = rows.filter((row) => row.clientId === null).length;
	const avgRemainingByBooked =
		total > 0
			? Number((rows.reduce((acc, row) => acc + row.remainingByBooked, 0) / total).toFixed(2))
			: 0;
	const avgRemainingByPassed =
		total > 0
			? Number((rows.reduce((acc, row) => acc + row.remainingByPassed, 0) / total).toFixed(2))
			: 0;

	return {
		total,
		urgent,
		watch,
		ok,
		fullBooked,
		nearFull,
		frozen,
		activeClient,
		inactiveClient,
		withoutClient,
		avgRemainingByBooked,
		avgRemainingByPassed,
		generatedAt
	};
}

function createBaseSql() {
	const consumesPackageExpr = `(b.status IS NULL OR b.status <> '${CANCELLED_STATUS}') AND ${packageFreeExclusionSql('b')} AND COALESCE(b.internal_education, FALSE) = FALSE`;

	return `
WITH package_base AS (
	SELECT
		p.id AS package_id,
		p.client_id,
		p.customer_id,
		p.article_id,
		p.paid_price,
		p.first_payment_date,
		p.frozen_from_date,
		p.autogiro,
		p.created_at,
		a.name AS article_name,
		COALESCE(a.sessions, 0) AS total_sessions,
		cu.name AS customer_name,
		cu.customer_no,
		NULLIF(BTRIM(CONCAT_WS(' ', c.firstname, c.lastname)), '') AS client_name,
		c.active AS client_active,
		c.primary_trainer_id,
		NULLIF(BTRIM(CONCAT_WS(' ', u.firstname, u.lastname)), '') AS trainer_name,
		c.primary_location_id,
		l.name AS location_name
	FROM packages p
	LEFT JOIN articles a ON a.id = p.article_id
	LEFT JOIN customers cu ON cu.id = p.customer_id
	LEFT JOIN clients c ON c.id = p.client_id
	LEFT JOIN users u ON u.id = c.primary_trainer_id
	LEFT JOIN locations l ON l.id = c.primary_location_id
	WHERE COALESCE(a.sessions, 0) > 0
),
booking_usage AS (
	SELECT
		b.package_id,
		COUNT(*) FILTER (WHERE ${consumesPackageExpr})::int AS booked_total,
		COUNT(*) FILTER (WHERE ${consumesPackageExpr} AND b.start_time <= NOW())::int AS booked_passed,
		COUNT(*) FILTER (WHERE ${consumesPackageExpr} AND b.start_time > NOW())::int AS booked_future,
		MIN(b.start_time) FILTER (WHERE ${consumesPackageExpr}) AS first_booking_at,
		MAX(b.start_time) FILTER (WHERE ${consumesPackageExpr}) AS last_booking_at,
		MAX(b.start_time) FILTER (WHERE ${consumesPackageExpr} AND b.start_time <= NOW()) AS last_passed_booking_at,
		MIN(b.start_time) FILTER (WHERE ${consumesPackageExpr} AND b.start_time > NOW()) AS next_booking_at
	FROM bookings b
	WHERE b.package_id IS NOT NULL
	GROUP BY b.package_id
)
SELECT
	pb.package_id,
	pb.client_id,
	pb.customer_id,
	pb.article_id,
	pb.paid_price,
	pb.first_payment_date,
	pb.frozen_from_date,
	pb.autogiro,
	pb.created_at,
	pb.article_name,
	pb.total_sessions,
	pb.customer_name,
	pb.customer_no,
	pb.client_name,
	pb.client_active,
	pb.primary_trainer_id,
	pb.trainer_name,
	pb.primary_location_id,
	pb.location_name,
	COALESCE(bu.booked_total, 0) AS booked_total,
	COALESCE(bu.booked_passed, 0) AS booked_passed,
	COALESCE(bu.booked_future, 0) AS booked_future,
	bu.first_booking_at,
	bu.last_booking_at,
	bu.last_passed_booking_at,
	bu.next_booking_at
FROM package_base pb
LEFT JOIN booking_usage bu ON bu.package_id = pb.package_id
ORDER BY pb.package_id DESC
`;
}

export async function getPackageRenewalRows(
	nearFullThreshold: number,
	closeToLastBookingDays: number
): Promise<PackageRenewalRow[]> {
	const sql = createBaseSql();
	const rows = (await query(sql)) as unknown as DbRow[];
	return rows.map((row) => mapRow(row, nearFullThreshold, closeToLastBookingDays));
}

async function fetchOptions(
	sql: string,
	mapper: (row: OptionRow) => PackageRenewalOption
): Promise<PackageRenewalOption[]> {
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

export async function getPackageRenewalOptions(): Promise<PackageRenewalOptions> {
	const [trainers, locations] = await Promise.all([
		fetchOptions(
			`
			SELECT DISTINCT u.id, u.firstname, u.lastname
			FROM packages p
			JOIN clients c ON c.id = p.client_id
			JOIN users u ON u.id = c.primary_trainer_id
			ORDER BY u.lastname NULLS LAST, u.firstname NULLS LAST
			`,
			mapPersonOption
		),
		fetchOptions(
			`
			SELECT DISTINCT l.id, l.name
			FROM packages p
			JOIN clients c ON c.id = p.client_id
			JOIN locations l ON l.id = c.primary_location_id
			ORDER BY l.name NULLS LAST
			`,
			mapNameOption
		)
	]);

	return { trainers, locations };
}

function applyCoreFilters(rows: PackageRenewalRow[], filters: PackageRenewalFilters) {
	const priority = filters.priority ?? 'attention';
	const capacity = filters.capacity ?? 'all';
	const client = filters.client ?? 'active';
	const frozen = filters.frozen ?? 'exclude_frozen';
	const byPriority = applyPriorityFilter(rows, priority);
	const byCapacity = applyCapacityFilter(byPriority, capacity);
	const byClient = applyClientFilter(byCapacity, client);
	const byFrozen = applyFrozenFilter(byClient, frozen);
	const byTrainer = applyTrainerFilter(byFrozen, filters.trainerId);
	const byLocation = applyLocationFilter(byTrainer, filters.locationId);
	return sortRows(byLocation);
}

export async function getPackageRenewalReport(
	filters: PackageRenewalFilters = {}
): Promise<PackageRenewalReport> {
	const nearFullThreshold = sanitizeThreshold(
		filters.nearFullThreshold,
		DEFAULT_NEAR_FULL_THRESHOLD,
		1,
		100
	);
	const closeToLastBookingDays = sanitizeThreshold(
		filters.closeToLastBookingDays,
		DEFAULT_CLOSE_TO_LAST_BOOKING_DAYS,
		1,
		365
	);

	const generatedAt = new Date().toISOString();
	const allRows = await getPackageRenewalRows(nearFullThreshold, closeToLastBookingDays);
	const summary = summarize(allRows, generatedAt);
	const filtered = applyCoreFilters(allRows, filters);
	const filteredSummary = summarize(filtered, generatedAt);
	const searchFiltered = applySearchFilter(filtered, filters.search);
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

function asDate(value: string | null) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function createFilename(filters: PackageRenewalFilters, generatedAt: string) {
	const now = new Date(generatedAt);
	const datePart = now.toISOString().slice(0, 10);
	const timePart = now.toISOString().slice(11, 16).replace(':', '');
	const priority = filters.priority ?? 'attention';
	const capacity = filters.capacity ?? 'all';
	return `package_renewal_${priority}_${capacity}_${datePart}_${timePart}.xlsx`;
}

export async function buildPackageRenewalWorkbook(filters: PackageRenewalFilters = {}) {
	const nearFullThreshold = sanitizeThreshold(
		filters.nearFullThreshold,
		DEFAULT_NEAR_FULL_THRESHOLD,
		1,
		100
	);
	const closeToLastBookingDays = sanitizeThreshold(
		filters.closeToLastBookingDays,
		DEFAULT_CLOSE_TO_LAST_BOOKING_DAYS,
		1,
		365
	);
	const generatedAt = new Date().toISOString();
	const allRows = await getPackageRenewalRows(nearFullThreshold, closeToLastBookingDays);
	const filtered = applyCoreFilters(allRows, filters);
	const rows = applySearchFilter(filtered, filters.search);

	const workbook = await createWorkbook();
	const worksheet = workbook.addWorksheet('Paketförnyelse');

	worksheet.addRow([
		'PaketId',
		'Prioritet',
		'Orsak',
		'Produkt',
		'Pass totalt',
		'Bokade pass',
		'Genomförda pass',
		'Framtida pass',
		'Kvar att boka',
		'Kvar att genomföra',
		'Första bokning',
		'Sista bokning',
		'Dagar till sista bokning',
		'Nästa bokning',
		'Senast genomförd',
		'Klient',
		'Aktiv klient',
		'Kund',
		'Kundnr',
		'Tränare',
		'Studio',
		'Fryst',
		'Fryst från',
		'Autogiro',
		'Första betalning',
		'Pris',
		'Skapad'
	]);
	worksheet.getRow(1).font = { bold: true };

	for (const row of rows) {
		worksheet.addRow([
			row.packageId,
			row.priorityLabel,
			row.urgencyReason,
			row.articleName ?? '',
			row.totalSessions,
			row.bookedTotal,
			row.bookedPassed,
			row.bookedFuture,
			row.remainingByBooked,
			row.remainingByPassed,
			asDate(row.firstBookingAt),
			asDate(row.lastBookingAt),
			row.daysToLastBooking ?? '',
			asDate(row.nextBookingAt),
			asDate(row.lastPassedBookingAt),
			row.clientName ?? '',
			row.clientActive === null ? '' : row.clientActive ? 'Ja' : 'Nej',
			row.customerName ?? '',
			row.customerNo ?? '',
			row.primaryTrainerName ?? '',
			row.primaryLocationName ?? '',
			row.isFrozen ? 'Ja' : 'Nej',
			asDate(row.frozenFromDate),
			row.autogiro ? 'Ja' : 'Nej',
			asDate(row.firstPaymentDate),
			row.paidPrice ?? '',
			asDate(row.createdAt)
		]);
	}

	const intCols = [1, 5, 6, 7, 8, 9, 10, 13];
	for (const colIndex of intCols) {
		worksheet.getColumn(colIndex).numFmt = '0';
	}

	const moneyCols = [26];
	for (const colIndex of moneyCols) {
		worksheet.getColumn(colIndex).numFmt = '#,##0.00';
	}

	const dateCols = [11, 12, 14, 15, 23, 25, 27];
	for (const colIndex of dateCols) {
		worksheet.getColumn(colIndex).numFmt = 'yyyy-mm-dd hh:mm';
	}

	worksheet.columns?.forEach((column) => {
		if (!column) return;
		let max = 12;
		column.eachCell?.({ includeEmpty: true }, (cell) => {
			const text = cell.value?.toString?.() ?? '';
			if (text.length + 2 > max) max = text.length + 2;
		});
		column.width = Math.min(max, 60);
	});

	worksheet.views = [{ state: 'frozen', ySplit: 1 }];

	const rawBuffer = await workbook.xlsx.writeBuffer();
	const buffer =
		rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer as ArrayBuffer);
	const filename = createFilename(filters, generatedAt);

	return { buffer, filename };
}
