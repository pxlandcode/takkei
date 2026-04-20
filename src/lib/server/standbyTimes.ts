import { query } from '$lib/db';
import { getNextStockholmDayStartLocal, getStockholmYmd } from '$lib/server/packageSemantics';
import { extractStockholmTimeParts } from '$lib/server/stockholm-time';
import { sendStyledEmail } from '$lib/services/mail/mailServerService';
import type {
	StandbyAvailableStart,
	StandbyDisplayClient,
	StandbyDisplayLocation,
	StandbyDisplayTrainer,
	StandbyMutationPayload,
	StandbyMutationResponse,
	StandbyTimeRecord
} from '$lib/types/standbyTypes';

const SLOT_DURATION_MINUTES = 60;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const EMPTY_INT_ARRAY_SQL = 'ARRAY[]::int[]';
const STANDBY_BOOKING_BASE_URL = 'https://superadmin-takkei.netlify.app';

type RawStandbyTimeRow = {
	id: number;
	trainer_id: number | null;
	client_id: number | null;
	location_ids: number[] | string[] | null;
	comment: string | null;
	wanted_start_time: string;
	wanted_end_time: string;
	created_at: string;
	updated_at: string;
	trainer_ids: number[] | string[] | null;
};

type StandbyRoom = {
	id: number;
	location_id: number;
	name: string;
	half_hour_start: boolean | null;
	active: boolean | null;
};

type StandbyBooking = {
	room_id: number | null;
	start_time: string;
	status: string | null;
};

type StandbyUnavailableRoom = {
	room_id: number | null;
	start_time: string | null;
	end_time: string | null;
};

type HydratedStandbyMaps = {
	owners: Map<number, StandbyDisplayTrainer>;
	trainers: Map<number, StandbyDisplayTrainer>;
	clients: Map<number, StandbyDisplayClient>;
	locations: Map<number, StandbyDisplayLocation>;
};

type PreparedStandbyMutation = {
	clientId: number | null;
	locationIds: number[];
	trainerIds: number[];
	comment: string | null;
	date: string;
	startTime: string;
	endTime: string;
	wantedStartTimeLocal: string;
	wantedEndTimeLocal: string;
	wantedStartAt: Date;
	wantedEndAt: Date;
};

type AvailableStartRoomInput = {
	id: number;
	locationId: number;
	halfHourStart: boolean;
	active: boolean;
};

type AvailableStartBookingInput = {
	roomId: number;
	startTime: string | Date;
	status: string | null;
};

type AvailableStartUnavailableInput = {
	roomId: number;
	startTime: string | Date | null;
	endTime: string | Date | null;
};

export class StandbyHttpError extends Error {
	status: number;
	errors: Record<string, string>;

	constructor(status: number, message: string, errors: Record<string, string> = {}) {
		super(message);
		this.name = 'StandbyHttpError';
		this.status = status;
		this.errors = errors;
	}
}

function pad2(value: number) {
	return String(value).padStart(2, '0');
}

function getLastSundayOfMonth(year: number, monthIndex: number) {
	const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
	const day = lastDay.getUTCDay();
	lastDay.setUTCDate(lastDay.getUTCDate() - day);
	return lastDay.getUTCDate();
}

function isStockholmDst(year: number, month: number, day: number, hour: number) {
	if (month < 3 || month > 10) return false;
	if (month > 3 && month < 10) return true;

	const marchLastSunday = getLastSundayOfMonth(year, 2);
	const octoberLastSunday = getLastSundayOfMonth(year, 9);

	if (month === 3) {
		if (day > marchLastSunday) return true;
		if (day < marchLastSunday) return false;
		return hour >= 2;
	}

	if (day < octoberLastSunday) return true;
	if (day > octoberLastSunday) return false;
	return hour < 3;
}

function getStockholmOffsetMinutes(year: number, month: number, day: number, hour: number) {
	return isStockholmDst(year, month, day, hour) ? 120 : 60;
}

function normalizeTimeString(value: string) {
	const trimmed = value.trim();
	if (!/^\d{2}:\d{2}$/.test(trimmed)) {
		throw new StandbyHttpError(400, 'Ogiltigt tidsformat', {
			startTime: 'Ange tid som HH:mm',
			endTime: 'Ange tid som HH:mm'
		});
	}
	return trimmed;
}

function normalizeDateString(value: string) {
	const trimmed = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		throw new StandbyHttpError(400, 'Ogiltigt datumformat', { date: 'Ange datum som YYYY-MM-DD' });
	}
	return trimmed;
}

function toInt(value: unknown) {
	const n = Number(value);
	return Number.isInteger(n) && n > 0 ? n : null;
}

function sanitizeOptionalInt(value: unknown) {
	if (value === null || value === undefined || value === '') return null;
	return toInt(value);
}

function sanitizeIntArray(input: unknown) {
	if (!Array.isArray(input)) return [];
	const values = new Set<number>();
	for (const value of input) {
		const parsed = toInt(value);
		if (parsed) values.add(parsed);
	}
	return Array.from(values);
}

function sanitizeDbIntArray(
	input: RawStandbyTimeRow['location_ids'] | RawStandbyTimeRow['trainer_ids']
) {
	if (!Array.isArray(input)) return [];
	const result: number[] = [];
	for (const value of input) {
		const parsed = toInt(value);
		if (parsed) result.push(parsed);
	}
	return result;
}

export function resolveTrainerIdFromLocalsUser(user: App.Locals['user'] | null | undefined) {
	if (!user || user.kind !== 'trainer') return null;
	const trainerId = toInt(user.trainerId ?? (user as { trainer_id?: unknown }).trainer_id);
	return trainerId;
}

export function canViewStandbyTime(
	viewerTrainerId: number,
	row: Pick<RawStandbyTimeRow, 'trainer_id' | 'trainer_ids'>
) {
	if (!Number.isInteger(viewerTrainerId) || viewerTrainerId <= 0) return false;
	if (row.trainer_id === viewerTrainerId) return true;
	return sanitizeDbIntArray(row.trainer_ids).includes(viewerTrainerId);
}

export function canManageStandbyTime(
	viewerTrainerId: number,
	row: Pick<RawStandbyTimeRow, 'trainer_id'>
) {
	return (
		Number.isInteger(viewerTrainerId) && viewerTrainerId > 0 && row.trainer_id === viewerTrainerId
	);
}

export function stockholmLocalDateTimeToUtcDate(date: string, time: string) {
	const normalizedDate = normalizeDateString(date);
	const normalizedTime = normalizeTimeString(time);
	const [year, month, day] = normalizedDate.split('-').map(Number);
	const [hour, minute] = normalizedTime.split(':').map(Number);
	const offsetMinutes = getStockholmOffsetMinutes(year, month, day, hour);
	const intendedUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
	return new Date(intendedUtc - offsetMinutes * 60 * 1000);
}

function toStandbyLocalTimestamp(date: string, time: string) {
	return `${normalizeDateString(date)} ${normalizeTimeString(time)}:00`;
}

function formatStockholmDate(value: string | Date) {
	const parts = extractStockholmTimeParts(value);
	if (!parts) return '';
	return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function formatStockholmTime(value: string | Date) {
	const parts = extractStockholmTimeParts(value);
	if (!parts) return '';
	return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

function formatStockholmDateTimeLabel(value: string | Date) {
	const parts = extractStockholmTimeParts(value);
	if (!parts) return '';
	return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} kl. ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

function escapeHtml(value: string | null | undefined) {
	if (!value) return '';
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function toEpoch(value: string | Date | null | undefined) {
	if (!value) return null;
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function toActiveStatus(status: string | null | undefined) {
	const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
	return normalized;
}

function normalizeErrors(message: string, errors: Record<string, string> = {}) {
	return Object.keys(errors).length > 0 ? errors : { general: message };
}

async function fetchOwnerRecord(ownerTrainerId: number) {
	const rows = await query(
		`SELECT id, firstname, lastname, email, active
		 FROM users
		 WHERE id = $1`,
		[ownerTrainerId]
	);
	return rows[0] ?? null;
}

async function ensureOwnerHasEmail(ownerTrainerId: number) {
	const owner = await fetchOwnerRecord(ownerTrainerId);
	if (!owner) {
		throw new StandbyHttpError(404, 'Tränaren hittades inte', {
			general: 'Tränaren hittades inte'
		});
	}
	if (typeof owner.email !== 'string' || owner.email.trim().length === 0) {
		throw new StandbyHttpError(400, 'Tränaren saknar e-postadress', {
			general: 'Din användare saknar e-postadress och kan inte spara standbytid.'
		});
	}
	return owner;
}

function prepareStandbyMutationPayload(body: unknown): PreparedStandbyMutation {
	const payload = (body ?? {}) as Partial<StandbyMutationPayload>;
	const errors: Record<string, string> = {};

	const date = typeof payload.date === 'string' ? payload.date.trim() : '';
	const startTime = typeof payload.startTime === 'string' ? payload.startTime.trim() : '';
	const endTime = typeof payload.endTime === 'string' ? payload.endTime.trim() : '';
	const comment =
		typeof payload.comment === 'string' && payload.comment.trim().length > 0
			? payload.comment.trim()
			: null;
	const clientId = sanitizeOptionalInt(payload.clientId);
	const locationIds = sanitizeIntArray(payload.locationIds);
	const trainerIds = sanitizeIntArray(payload.trainerIds);

	if (!date) {
		errors.date = 'Datum krävs';
	} else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		errors.date = 'Ogiltigt datum';
	}

	if (!startTime) {
		errors.startTime = 'Starttid krävs';
	} else if (!/^\d{2}:\d{2}$/.test(startTime)) {
		errors.startTime = 'Ogiltig starttid';
	}

	if (!endTime) {
		errors.endTime = 'Sluttid krävs';
	} else if (!/^\d{2}:\d{2}$/.test(endTime)) {
		errors.endTime = 'Ogiltig sluttid';
	}

	if (locationIds.length === 0) {
		errors.locationIds = 'Välj minst en plats';
	}

	if (trainerIds.length === 0) {
		errors.trainerIds = 'Välj minst en tränare';
	}

	if (Object.keys(errors).length > 0) {
		throw new StandbyHttpError(
			400,
			'Ogiltig standbytid',
			normalizeErrors('Ogiltig standbytid', errors)
		);
	}

	const wantedStartAt = stockholmLocalDateTimeToUtcDate(date, startTime);
	const wantedEndAt = stockholmLocalDateTimeToUtcDate(date, endTime);

	if (wantedEndAt.getTime() < wantedStartAt.getTime()) {
		throw new StandbyHttpError(400, 'Sluttiden är ogiltig', {
			endTime: 'Sluttiden måste vara samma eller senare än starttiden'
		});
	}

	if (wantedEndAt.getTime() <= Date.now()) {
		throw new StandbyHttpError(400, 'Standbytiden måste ligga i framtiden', {
			endTime: 'Senaste möjliga starttid måste ligga i framtiden'
		});
	}

	return {
		clientId,
		locationIds,
		trainerIds,
		comment,
		date,
		startTime,
		endTime,
		wantedStartTimeLocal: toStandbyLocalTimestamp(date, startTime),
		wantedEndTimeLocal: toStandbyLocalTimestamp(date, endTime),
		wantedStartAt,
		wantedEndAt
	};
}

async function fetchStandbyMaps(rows: RawStandbyTimeRow[]): Promise<HydratedStandbyMaps> {
	const ownerIds = new Set<number>();
	const trainerIds = new Set<number>();
	const clientIds = new Set<number>();
	const locationIds = new Set<number>();

	for (const row of rows) {
		if (row.trainer_id) ownerIds.add(row.trainer_id);
		for (const trainerId of sanitizeDbIntArray(row.trainer_ids)) trainerIds.add(trainerId);
		if (row.client_id) clientIds.add(row.client_id);
		for (const locationId of sanitizeDbIntArray(row.location_ids)) locationIds.add(locationId);
	}

	const [ownerRows, trainerRows, clientRows, locationRows] = await Promise.all([
		ownerIds.size > 0
			? query(
					`SELECT id, firstname, lastname, email, active FROM users WHERE id = ANY($1::int[])`,
					[Array.from(ownerIds)]
				)
			: Promise.resolve([]),
		trainerIds.size > 0
			? query(
					`SELECT id, firstname, lastname, email, active FROM users WHERE id = ANY($1::int[])`,
					[Array.from(trainerIds)]
				)
			: Promise.resolve([]),
		clientIds.size > 0
			? query(
					`SELECT id, firstname, lastname, email, active FROM clients WHERE id = ANY($1::int[])`,
					[Array.from(clientIds)]
				)
			: Promise.resolve([]),
		locationIds.size > 0
			? query(`SELECT id, name, color FROM locations WHERE id = ANY($1::int[])`, [
					Array.from(locationIds)
				])
			: Promise.resolve([])
	]);

	const owners = new Map<number, StandbyDisplayTrainer>();
	const trainers = new Map<number, StandbyDisplayTrainer>();
	const clients = new Map<number, StandbyDisplayClient>();
	const locations = new Map<number, StandbyDisplayLocation>();

	for (const row of ownerRows) {
		owners.set(Number(row.id), {
			id: Number(row.id),
			firstname: row.firstname ?? '',
			lastname: row.lastname ?? '',
			email: row.email ?? null,
			active: row.active ?? null
		});
	}

	for (const row of trainerRows) {
		trainers.set(Number(row.id), {
			id: Number(row.id),
			firstname: row.firstname ?? '',
			lastname: row.lastname ?? '',
			email: row.email ?? null,
			active: row.active ?? null
		});
	}

	for (const row of clientRows) {
		clients.set(Number(row.id), {
			id: Number(row.id),
			firstname: row.firstname ?? '',
			lastname: row.lastname ?? '',
			email: row.email ?? null,
			active: row.active ?? null
		});
	}

	for (const row of locationRows) {
		locations.set(Number(row.id), {
			id: Number(row.id),
			name: row.name ?? '',
			color: row.color ?? null
		});
	}

	return { owners, trainers, clients, locations };
}

function serializeStandbyTime(
	row: RawStandbyTimeRow,
	maps: HydratedStandbyMaps,
	viewerTrainerId: number | null
): StandbyTimeRecord {
	const ownerTrainerId = row.trainer_id ?? null;
	const clientId = row.client_id ?? null;
	const locationIds = sanitizeDbIntArray(row.location_ids);
	const trainerIds = sanitizeDbIntArray(row.trainer_ids);
	const wantedStartTime = row.wanted_start_time;
	const wantedEndTime = row.wanted_end_time;
	const viewerId = viewerTrainerId ?? null;

	return {
		id: Number(row.id),
		ownerTrainerId,
		clientId,
		locationIds,
		trainerIds,
		comment: row.comment ?? null,
		wantedStartTime,
		wantedEndTime,
		date: formatStockholmDate(wantedStartTime),
		startTime: formatStockholmTime(wantedStartTime),
		endTime: formatStockholmTime(wantedEndTime),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		owner: ownerTrainerId ? (maps.owners.get(ownerTrainerId) ?? null) : null,
		client: clientId ? (maps.clients.get(clientId) ?? null) : null,
		locations: locationIds
			.map((locationId) => maps.locations.get(locationId))
			.filter((location): location is StandbyDisplayLocation => Boolean(location)),
		trainers: trainerIds
			.map((trainerId) => maps.trainers.get(trainerId))
			.filter((trainer): trainer is StandbyDisplayTrainer => Boolean(trainer)),
		expired: toEpoch(wantedEndTime) !== null && (toEpoch(wantedEndTime) ?? 0) <= Date.now(),
		isOwner: viewerId !== null && ownerTrainerId === viewerId,
		isVisibleRecipient: viewerId !== null && trainerIds.includes(viewerId)
	};
}

async function hydrateStandbyRows(rows: RawStandbyTimeRow[], viewerTrainerId: number | null) {
	if (rows.length === 0) return [];
	const maps = await fetchStandbyMaps(rows);
	return rows.map((row) => serializeStandbyTime(row, maps, viewerTrainerId));
}

async function fetchStandbyRowById(id: number) {
	const rows = await query(`SELECT * FROM standby_times WHERE id = $1`, [id]);
	return (rows[0] as RawStandbyTimeRow | undefined) ?? null;
}

export async function listStandbyTimesForViewer(viewerTrainerId: number, showAll = false) {
	const rows = await query(
		showAll
			? `SELECT *
         FROM standby_times
         WHERE $1::int = ANY(COALESCE(trainer_ids, ${EMPTY_INT_ARRAY_SQL}))
            OR trainer_id = $1
         ORDER BY wanted_start_time DESC`
			: `SELECT *
         FROM standby_times
         WHERE $1::int = ANY(COALESCE(trainer_ids, ${EMPTY_INT_ARRAY_SQL}))
           AND wanted_end_time > $2
         ORDER BY wanted_start_time DESC`,
		showAll ? [viewerTrainerId] : [viewerTrainerId, new Date()]
	);

	return hydrateStandbyRows(rows as RawStandbyTimeRow[], viewerTrainerId);
}

export async function getStandbyTimeForViewer(id: number, viewerTrainerId: number) {
	const row = await fetchStandbyRowById(id);
	if (!row) {
		throw new StandbyHttpError(404, 'Standbytiden hittades inte', {
			general: 'Standbytiden hittades inte'
		});
	}
	if (!canViewStandbyTime(viewerTrainerId, row)) {
		throw new StandbyHttpError(403, 'Du saknar behörighet att visa standbytiden', {
			general: 'Du saknar behörighet att visa standbytiden'
		});
	}

	const hydrated = await hydrateStandbyRows([row], viewerTrainerId);
	return hydrated[0];
}

async function computeSaveWarnings(input: PreparedStandbyMutation) {
	const availableStarts = await findAvailableStandbyStartsForRequest({
		locationIds: input.locationIds,
		wantedStartTime: input.wantedStartTimeLocal,
		wantedEndTime: input.wantedEndTimeLocal
	});

	return { availableStarts };
}

export async function createStandbyTime(
	ownerTrainerId: number,
	body: unknown
): Promise<StandbyMutationResponse> {
	await ensureOwnerHasEmail(ownerTrainerId);
	const payload = prepareStandbyMutationPayload(body);

	const insertedRows = await query(
		`INSERT INTO standby_times (
        trainer_id,
        client_id,
        location_ids,
        comment,
        wanted_start_time,
        wanted_end_time,
        created_at,
        updated_at,
        trainer_ids
      )
      VALUES ($1, $2, $3::int[], $4, $5, $6, NOW(), NOW(), $7::int[])
      RETURNING *`,
		[
			ownerTrainerId,
			payload.clientId,
			payload.locationIds,
			payload.comment,
			payload.wantedStartTimeLocal,
			payload.wantedEndTimeLocal,
			payload.trainerIds
		]
	);

	const warnings = await computeSaveWarnings(payload);
	const hydrated = await hydrateStandbyRows(insertedRows as RawStandbyTimeRow[], ownerTrainerId);

	return {
		standbyTime: hydrated[0],
		warnings
	};
}

export async function updateStandbyTime(
	id: number,
	viewerTrainerId: number,
	body: unknown
): Promise<StandbyMutationResponse> {
	const existing = await fetchStandbyRowById(id);
	if (!existing) {
		throw new StandbyHttpError(404, 'Standbytiden hittades inte', {
			general: 'Standbytiden hittades inte'
		});
	}
	if (!canManageStandbyTime(viewerTrainerId, existing)) {
		throw new StandbyHttpError(403, 'Du saknar behörighet att uppdatera standbytiden', {
			general: 'Du saknar behörighet att uppdatera standbytiden'
		});
	}

	await ensureOwnerHasEmail(viewerTrainerId);
	const payload = prepareStandbyMutationPayload(body);

	const updatedRows = await query(
		`UPDATE standby_times
       SET client_id = $1,
           location_ids = $2::int[],
           comment = $3,
           wanted_start_time = $4,
           wanted_end_time = $5,
           trainer_ids = $6::int[],
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
		[
			payload.clientId,
			payload.locationIds,
			payload.comment,
			payload.wantedStartTimeLocal,
			payload.wantedEndTimeLocal,
			payload.trainerIds,
			id
		]
	);

	const warnings = await computeSaveWarnings(payload);
	const hydrated = await hydrateStandbyRows(updatedRows as RawStandbyTimeRow[], viewerTrainerId);

	return {
		standbyTime: hydrated[0],
		warnings
	};
}

export async function deleteStandbyTime(id: number, viewerTrainerId: number) {
	const existing = await fetchStandbyRowById(id);
	if (!existing) {
		throw new StandbyHttpError(404, 'Standbytiden hittades inte', {
			general: 'Standbytiden hittades inte'
		});
	}
	if (!canManageStandbyTime(viewerTrainerId, existing)) {
		throw new StandbyHttpError(403, 'Du saknar behörighet att ta bort standbytiden', {
			general: 'Du saknar behörighet att ta bort standbytiden'
		});
	}

	await query(`DELETE FROM standby_times WHERE id = $1`, [id]);
}

export function standbyTimeMatchesFreedSlot(
	row: Pick<RawStandbyTimeRow, 'location_ids' | 'wanted_start_time' | 'wanted_end_time'>,
	locationId: number,
	freedSlotStart: string | Date
) {
	const locations = sanitizeDbIntArray(row.location_ids);
	if (!locations.includes(locationId)) return false;

	const freedEpoch = toEpoch(freedSlotStart);
	const wantedStartEpoch = toEpoch(row.wanted_start_time);
	const wantedEndEpoch = toEpoch(row.wanted_end_time);
	const standbyDate = formatStockholmDate(row.wanted_start_time);
	const freedDate = formatStockholmDate(freedSlotStart);

	if (
		freedEpoch === null ||
		wantedStartEpoch === null ||
		wantedEndEpoch === null ||
		standbyDate !== freedDate
	) {
		return false;
	}

	return wantedStartEpoch <= freedEpoch && wantedEndEpoch >= freedEpoch;
}

export async function getMatchingStandbyTimesForBooking(id: number, viewerTrainerId: number) {
	const bookingRows = await query(
		`SELECT id, client_id, location_id, start_time
       FROM bookings
       WHERE id = $1`,
		[id]
	);

	const booking = bookingRows[0] ?? null;
	if (!booking) {
		throw new StandbyHttpError(404, 'Bokningen hittades inte', {
			general: 'Bokningen hittades inte'
		});
	}

	const bookingClientId = toInt(booking.client_id);
	const bookingLocationId = toInt(booking.location_id);
	const bookingStartTime = booking.start_time ?? null;

	if (!bookingClientId || !bookingLocationId || !bookingStartTime) {
		return [];
	}

	const rows = (await query(
		`SELECT *
       FROM standby_times
       WHERE client_id = $1
         AND $2::int = ANY(COALESCE(location_ids, ${EMPTY_INT_ARRAY_SQL}))
         AND wanted_start_time <= $3
         AND wanted_end_time >= $3
       ORDER BY wanted_start_time DESC`,
		[bookingClientId, bookingLocationId, bookingStartTime]
	)) as RawStandbyTimeRow[];

	const visible = rows.filter((row) => canViewStandbyTime(viewerTrainerId, row));
	return hydrateStandbyRows(visible, viewerTrainerId);
}

function roomMatchesMinute(room: AvailableStartRoomInput, minute: number) {
	if (minute === 0) return !room.halfHourStart;
	if (minute === 30) return room.halfHourStart;
	return false;
}

function buildRoomBookingKey(roomId: number, epoch: number) {
	return `${roomId}:${epoch}`;
}

function buildAvailableStartRecord(
	location: StandbyDisplayLocation,
	startEpoch: number
): StandbyAvailableStart {
	const startTime = new Date(startEpoch).toISOString();
	return {
		locationId: location.id,
		locationName: location.name,
		startTime,
		date: formatStockholmDate(startTime),
		time: formatStockholmTime(startTime)
	};
}

export function findAvailableStandbyStarts({
	locations,
	rooms,
	bookings,
	unavailableRooms,
	wantedStartTime,
	wantedEndTime
}: {
	locations: StandbyDisplayLocation[];
	rooms: AvailableStartRoomInput[];
	bookings: AvailableStartBookingInput[];
	unavailableRooms: AvailableStartUnavailableInput[];
	wantedStartTime: string | Date;
	wantedEndTime: string | Date;
}): StandbyAvailableStart[] {
	const wantedStartEpoch = toEpoch(wantedStartTime);
	const wantedEndEpoch = toEpoch(wantedEndTime);

	if (wantedStartEpoch === null || wantedEndEpoch === null || wantedEndEpoch < wantedStartEpoch) {
		return [];
	}

	const activeRooms = rooms.filter((room) => room.active);
	const bookingsByRoomAndStart = new Set<string>();
	for (const booking of bookings) {
		const roomId = toInt(booking.roomId);
		const startEpoch = toEpoch(booking.startTime);
		if (!roomId || startEpoch === null) continue;
		const status = toActiveStatus(booking.status);
		if (status && status !== 'new') continue;
		bookingsByRoomAndStart.add(buildRoomBookingKey(roomId, startEpoch));
	}

	const unavailableByRoom = new Map<number, Array<{ startEpoch: number; endEpoch: number }>>();
	for (const row of unavailableRooms) {
		const roomId = toInt(row.roomId);
		const startEpoch = toEpoch(row.startTime);
		const endEpoch = toEpoch(row.endTime);
		if (!roomId || startEpoch === null || endEpoch === null) continue;
		const list = unavailableByRoom.get(roomId) ?? [];
		list.push({ startEpoch, endEpoch });
		unavailableByRoom.set(roomId, list);
	}

	const results: StandbyAvailableStart[] = [];

	for (const location of locations) {
		const locationRooms = activeRooms
			.filter((room) => room.locationId === location.id)
			.sort((left, right) => left.id - right.id);
		if (locationRooms.length === 0) continue;

		const hasFullHour = locationRooms.some((room) => !room.halfHourStart);
		const hasHalfHour = locationRooms.some((room) => room.halfHourStart);
		if (!hasFullHour && !hasHalfHour) continue;

		let candidateEpoch = wantedStartEpoch;
		while (candidateEpoch <= wantedEndEpoch) {
			const minute = extractStockholmTimeParts(new Date(candidateEpoch))?.minute ?? null;
			const matchesRoomType =
				minute !== null && ((minute === 0 && hasFullHour) || (minute === 30 && hasHalfHour));
			if (matchesRoomType) break;
			candidateEpoch += THIRTY_MINUTES_MS;
		}

		const stepMs = hasFullHour && hasHalfHour ? THIRTY_MINUTES_MS : HOUR_MS;

		for (; candidateEpoch <= wantedEndEpoch; candidateEpoch += stepMs) {
			const candidateMinute = extractStockholmTimeParts(new Date(candidateEpoch))?.minute ?? null;
			if (candidateMinute === null) continue;

			const room = locationRooms.find((currentRoom) => {
				if (!roomMatchesMinute(currentRoom, candidateMinute)) return false;
				if (bookingsByRoomAndStart.has(buildRoomBookingKey(currentRoom.id, candidateEpoch))) {
					return false;
				}

				const sessionEnd = candidateEpoch + SLOT_DURATION_MINUTES * 60 * 1000;
				const blockingIntervals = unavailableByRoom.get(currentRoom.id) ?? [];
				return !blockingIntervals.some(
					(interval) => interval.startEpoch <= candidateEpoch && interval.endEpoch >= sessionEnd
				);
			});

			if (room) {
				results.push(buildAvailableStartRecord(location, candidateEpoch));
			}
		}
	}

	return results;
}

export async function findAvailableStandbyStartsForRequest({
	locationIds,
	wantedStartTime,
	wantedEndTime
}: {
	locationIds: number[];
	wantedStartTime: string;
	wantedEndTime: string;
}) {
	const normalizedLocationIds = sanitizeIntArray(locationIds);
	if (normalizedLocationIds.length === 0) return [];

	const ymd = getStockholmYmd(wantedStartTime);
	const nextDayStart = ymd ? getNextStockholmDayStartLocal(wantedStartTime) : null;
	if (!ymd || !nextDayStart) return [];

	const rooms = (await query(
		`SELECT id, location_id, name, half_hour_start, active
       FROM rooms
       WHERE location_id = ANY($1::int[])
         AND COALESCE(active, true) = true`,
		[normalizedLocationIds]
	)) as StandbyRoom[];

	if (rooms.length === 0) return [];

	const roomIds = rooms.map((room) => Number(room.id));

	const [bookingRows, unavailableRows, locationRows] = await Promise.all([
		query(
			`SELECT room_id, start_time, status
         FROM bookings
         WHERE room_id = ANY($1::int[])
           AND start_time >= $2
           AND start_time < $3`,
			[roomIds, `${ymd} 00:00:00`, nextDayStart]
		),
		query(
			`SELECT room_id, start_time, end_time
         FROM unavailable_rooms
         WHERE room_id = ANY($1::int[])
           AND start_time < $3
           AND end_time > $2`,
			[roomIds, `${ymd} 00:00:00`, nextDayStart]
		),
		query(`SELECT id, name, color FROM locations WHERE id = ANY($1::int[])`, [
			normalizedLocationIds
		])
	]);

	return findAvailableStandbyStarts({
		locations: locationRows.map((row) => ({
			id: Number(row.id),
			name: row.name ?? '',
			color: row.color ?? null
		})),
		rooms: rooms.map((room) => ({
			id: Number(room.id),
			locationId: Number(room.location_id),
			halfHourStart: Boolean(room.half_hour_start),
			active: room.active ?? true
		})),
		bookings: (bookingRows as StandbyBooking[]).map((booking) => ({
			roomId: Number(booking.room_id),
			startTime: booking.start_time,
			status: booking.status ?? null
		})),
		unavailableRooms: (unavailableRows as StandbyUnavailableRoom[]).map((row) => ({
			roomId: Number(row.room_id),
			startTime: row.start_time,
			endTime: row.end_time
		})),
		wantedStartTime,
		wantedEndTime
	});
}

function buildStandbyBookingLink({
	freedSlotStart,
	locationId,
	clientId
}: {
	freedSlotStart: string;
	locationId: number;
	clientId: number | null;
}) {
	const params = new URLSearchParams();
	const date = getStockholmYmd(freedSlotStart);
	if (date) params.set('date', date);
	params.set('locationId', String(locationId));
	if (clientId) params.set('clientId', String(clientId));
	const queryString = params.toString();
	return queryString
		? `${STANDBY_BOOKING_BASE_URL}/calendar?${queryString}`
		: `${STANDBY_BOOKING_BASE_URL}/calendar`;
}

function buildStandbyEmailBody({
	standbyTime,
	freedSlotStart,
	locationName,
	locationId
}: {
	standbyTime: StandbyTimeRecord;
	freedSlotStart: string;
	locationName: string;
	locationId: number;
}) {
	const freedSlotLabel = formatStockholmDateTimeLabel(freedSlotStart);
	const requestedLocations = standbyTime.locations
		.map((location) => escapeHtml(location.name))
		.join(', ');
	const bookingLink = buildStandbyBookingLink({
		freedSlotStart,
		locationId,
		clientId: standbyTime.clientId
	});

	const lines = [
		`En tid har blivit ledig <strong>${escapeHtml(locationName)}</strong> ${escapeHtml(freedSlotLabel)}.`,
		`<br>`,
		`<strong>Önskad tid:</strong> ${escapeHtml(standbyTime.date)} kl. ${escapeHtml(standbyTime.startTime)} - ${escapeHtml(standbyTime.endTime)}`,
		`<br>`,
		`<strong>Valda platser:</strong> ${requestedLocations || 'Inga platser angivna'}`
	];

	if (standbyTime.client) {
		lines.push(
			`<br>`,
			`<strong>Kund:</strong> ${escapeHtml(standbyTime.client.firstname)} ${escapeHtml(standbyTime.client.lastname)}`
		);
	}

	if (standbyTime.comment) {
		lines.push(`<br>`, `<strong>Kommentar:</strong> ${escapeHtml(standbyTime.comment)}`);
	}

	lines.push(
		`<br><br>`,
		`<a href="${bookingLink}" style="color:#f97316; font-weight:600; text-decoration:none;">Öppna kalendern</a>`
	);

	return lines.join('');
}

export async function notifyStandbyTimesAboutCancelledBooking({
	startTime,
	locationId
}: {
	startTime: string | null | undefined;
	locationId: number | null | undefined;
}) {
	if (!startTime || !locationId) {
		return { matchedCount: 0, deliveredCount: 0 };
	}

	const freedSlotEpoch = toEpoch(startTime);
	if (freedSlotEpoch === null || freedSlotEpoch <= Date.now()) {
		return { matchedCount: 0, deliveredCount: 0 };
	}

	const dayStart = getStockholmYmd(startTime);
	const nextDayStart = getNextStockholmDayStartLocal(startTime);
	if (!dayStart || !nextDayStart) {
		return { matchedCount: 0, deliveredCount: 0 };
	}

	const rows = (await query(
		`SELECT *
       FROM standby_times
       WHERE $1::int = ANY(COALESCE(location_ids, ${EMPTY_INT_ARRAY_SQL}))
         AND wanted_start_time > $2
         AND wanted_end_time < $3`,
		[locationId, `${dayStart} 00:00:00`, nextDayStart]
	)) as RawStandbyTimeRow[];

	const matchingRows = rows.filter((row) =>
		standbyTimeMatchesFreedSlot(row, locationId, startTime)
	);
	if (matchingRows.length === 0) {
		return { matchedCount: 0, deliveredCount: 0 };
	}

	const hydrated = await hydrateStandbyRows(matchingRows, null);
	const freedLocationName =
		hydrated[0]?.locations.find((location) => location.id === locationId)?.name ??
		(await query(`SELECT name FROM locations WHERE id = $1`, [locationId]))[0]?.name ??
		'vald plats';

	let deliveredCount = 0;

	for (const standbyTime of hydrated) {
		const recipients = Array.from(
			new Set(
				standbyTime.trainers
					.map((trainer) => trainer.email?.trim() ?? '')
					.filter((email) => email.length > 0)
			)
		);

		if (recipients.length === 0) {
			continue;
		}

		try {
			await sendStyledEmail({
				to: recipients,
				subject: 'Standbytid tillgänglig',
				header: 'Standbytid tillgänglig',
				subheader: `${freedLocationName} ${formatStockholmDateTimeLabel(startTime)}`,
				body: buildStandbyEmailBody({
					standbyTime,
					freedSlotStart: startTime,
					locationName: freedLocationName,
					locationId
				})
			});
			deliveredCount += 1;
		} catch (error) {
			console.error('Failed to send standby notification email', {
				standbyTimeId: standbyTime.id,
				error
			});
		}
	}

	return {
		matchedCount: hydrated.length,
		deliveredCount
	};
}
