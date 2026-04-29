import { query } from '$lib/db';
import { extractStockholmTimeParts } from '$lib/server/stockholm-time';

const HOUR_MS = 60 * 60 * 1000;
const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_RE = /^\d{1,2}:\d{2}$/;
const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/;

export type SqlQueryFn = (text: string, params?: unknown[]) => Promise<any[]>;

export type RoomAvailabilityRoom = {
	id: number;
	locationId: number;
	name: string;
	halfHourStart: boolean;
	active: boolean;
};

export type RoomAvailabilityBooking = {
	id?: number | null;
	roomId: number | null;
	startTime: string | Date;
	status: string | null;
};

export type RoomAvailabilityBlock = {
	id?: number | null;
	roomId: number | null;
	startTime: string | Date | null;
	endTime: string | Date | null;
	reason?: string | null;
	addedById?: number | null;
};

export type RoomAvailabilityContext = {
	rooms: RoomAvailabilityRoom[];
	bookings: RoomAvailabilityBooking[];
	roomBlocks: RoomAvailabilityBlock[];
};

export type RoomAvailabilityResult = {
	startEpoch: number | null;
	sessionEndEpoch: number | null;
	matchingRoomIds: number[];
	bookedRoomIds: number[];
	blockedRoomIds: number[];
	availableRoomIds: number[];
	selectedRoomId: number | null;
};

export type CurrentOrFutureRoomBlock = {
	id: number;
	roomId: number;
	roomName: string;
	roomHalfHourStart: boolean;
	startTime: string;
	endTime: string;
	reason: string | null;
	addedById: number | null;
	addedByName: string | null;
	createdAt: string | null;
	updatedAt: string | null;
};

export type RoomBlockMutationInput = {
	roomId: number;
	locationId?: number | null;
	startDate: string;
	startTime: string;
	endDate: string;
	endTime: string;
	reason?: string | null;
	repeatWeekly?: boolean;
	repeatUntil?: string | null;
	addedById: number;
};

export class RoomBlockHttpError extends Error {
	status: number;
	errors: Record<string, string>;

	constructor(status: number, message: string, errors: Record<string, string> = {}) {
		super(message);
		this.name = 'RoomBlockHttpError';
		this.status = status;
		this.errors = errors;
	}
}

function pad2(value: number) {
	return String(value).padStart(2, '0');
}

function toInt(value: unknown): number | null {
	const numeric = Number(value);
	if (!Number.isInteger(numeric) || numeric <= 0) return null;
	return numeric;
}

function normalizeBoolean(value: unknown) {
	return value === true || value === 'true' || value === 1 || value === '1';
}

function normalizeReason(value: unknown) {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeDateInput(value: unknown, field: string) {
	if (typeof value !== 'string' || !LOCAL_DATE_RE.test(value.trim())) {
		throw new RoomBlockHttpError(400, 'Ogiltigt datum', {
			[field]: 'Ange datum som YYYY-MM-DD'
		});
	}
	return value.trim();
}

function normalizeTimeInput(value: unknown, field: string) {
	if (typeof value !== 'string' || !LOCAL_TIME_RE.test(value.trim())) {
		throw new RoomBlockHttpError(400, 'Ogiltig tid', {
			[field]: 'Ange tid som HH:mm'
		});
	}

	const [hoursString, minutesString] = value.trim().split(':');
	const hours = Number(hoursString);
	const minutes = Number(minutesString);

	if (
		!Number.isInteger(hours) ||
		hours < 0 ||
		hours > 23 ||
		!Number.isInteger(minutes) ||
		minutes < 0 ||
		minutes > 59
	) {
		throw new RoomBlockHttpError(400, 'Ogiltig tid', {
			[field]: 'Ange en giltig tid'
		});
	}

	return `${pad2(hours)}:${pad2(minutes)}`;
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

function stockholmLocalDateTimeToUtcDate(value: string) {
	const normalized = value.trim().replace('T', ' ');
	const expanded = LOCAL_DATE_RE.test(normalized)
		? `${normalized} 00:00:00`
		: normalized.length === 16
			? `${normalized}:00`
			: normalized;

	const [datePart, timePart] = expanded.split(' ');
	const [year, month, day] = datePart.split('-').map(Number);
	const [hourString, minuteString, secondString = '0'] = timePart.split(':');
	const hour = Number(hourString);
	const minute = Number(minuteString);
	const second = Number(secondString);
	const offsetMinutes = getStockholmOffsetMinutes(year, month, day, hour);
	const intendedUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);
	return new Date(intendedUtc - offsetMinutes * 60 * 1000);
}

function toEpoch(value: string | Date | null | undefined) {
	if (!value) return null;
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value.getTime();
	}

	const trimmed = value.trim();
	if (LOCAL_DATE_RE.test(trimmed) || LOCAL_DATETIME_RE.test(trimmed)) {
		return stockholmLocalDateTimeToUtcDate(trimmed).getTime();
	}

	const direct = new Date(trimmed);
	if (!Number.isNaN(direct.getTime())) return direct.getTime();

	const withZ = trimmed.endsWith('Z') ? trimmed : `${trimmed}Z`;
	const withZulu = new Date(withZ);
	return Number.isNaN(withZulu.getTime()) ? null : withZulu.getTime();
}

function isActiveBookingStatus(status: string | null | undefined) {
	const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';
	return normalized !== 'cancelled' && normalized !== 'late_cancelled';
}

function roomMatchesMinute(room: Pick<RoomAvailabilityRoom, 'halfHourStart'>, minute: number) {
	if (minute === 0) return room.halfHourStart === false;
	if (minute === 30) return room.halfHourStart === true;
	return false;
}

function compareDateStrings(left: string, right: string) {
	return left.localeCompare(right);
}

function formatYmdUtc(date: Date) {
	return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function addDaysToDateString(date: string, days: number) {
	const normalized = normalizeDateInput(date, 'date');
	const [year, month, day] = normalized.split('-').map(Number);
	const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
	utcDate.setUTCDate(utcDate.getUTCDate() + days);
	return formatYmdUtc(utcDate);
}

export function buildRoomBlockTimestamp(date: string, time: string) {
	const normalizedDate = normalizeDateInput(date, 'date');
	const normalizedTime = normalizeTimeInput(time, 'time');
	return `${normalizedDate} ${normalizedTime}:00`;
}

function resolveDayStart(date: string) {
	return `${normalizeDateInput(date, 'date')} 00:00:00`;
}

function resolveNextDayStart(date: string) {
	return `${addDaysToDateString(date, 1)} 00:00:00`;
}

function assertValidRoomBlockRange(
	startDate: string,
	startTime: string,
	endDate: string,
	endTime: string
) {
	const startTimestamp = buildRoomBlockTimestamp(startDate, startTime);
	const endTimestamp = buildRoomBlockTimestamp(endDate, endTime);
	const startEpoch = toEpoch(startTimestamp);
	const endEpoch = toEpoch(endTimestamp);

	if (startEpoch === null || endEpoch === null || endEpoch <= startEpoch) {
		throw new RoomBlockHttpError(400, 'Ogiltigt tidsintervall', {
			endTime: 'Sluttiden måste vara senare än starttiden'
		});
	}
}

async function ensureRoomExists(
	queryFn: SqlQueryFn,
	roomId: number,
	locationId: number | null = null
) {
	const roomRows = await queryFn(
		`
		SELECT id, location_id
		FROM rooms
		WHERE id = $1
		  AND ($2::int IS NULL OR location_id = $2)
		LIMIT 1
		`,
		[roomId, locationId]
	);

	if (!roomRows.length) {
		throw new RoomBlockHttpError(400, 'Rummet hittades inte', {
			roomId:
				locationId === null
					? 'Rummet hittades inte'
					: 'Rummet finns inte på den valda platsen'
		});
	}
}

function mapCurrentOrFutureRoomBlock(row: any): CurrentOrFutureRoomBlock {
	const firstname = typeof row.added_by_firstname === 'string' ? row.added_by_firstname.trim() : '';
	const lastname = typeof row.added_by_lastname === 'string' ? row.added_by_lastname.trim() : '';
	const addedByName = `${firstname} ${lastname}`.trim();

	return {
		id: Number(row.id),
		roomId: Number(row.room_id),
		roomName: row.room_name ?? '',
		roomHalfHourStart: Boolean(row.room_half_hour_start),
		startTime: row.start_time,
		endTime: row.end_time,
		reason: row.reason ?? null,
		addedById: toInt(row.added_by_id),
		addedByName: addedByName.length > 0 ? addedByName : null,
		createdAt: row.created_at ?? null,
		updatedAt: row.updated_at ?? null
	};
}

async function fetchRoomBlocksByIds(queryFn: SqlQueryFn, ids: number[]) {
	if (ids.length === 0) return [];

	const rows = await queryFn(
		`
		SELECT
			ur.*,
			r.name AS room_name,
			r.half_hour_start AS room_half_hour_start,
			u.firstname AS added_by_firstname,
			u.lastname AS added_by_lastname
		FROM unavailable_rooms ur
		JOIN rooms r ON r.id = ur.room_id
		LEFT JOIN users u ON u.id = ur.added_by_id
		WHERE ur.id = ANY($1::int[])
		ORDER BY ur.start_time ASC, ur.id ASC
		`,
		[ids]
	);

	return rows.map(mapCurrentOrFutureRoomBlock);
}

export async function loadLocationRoomAvailabilityContext({
	queryFn = query as SqlQueryFn,
	locationId,
	windowStart,
	windowEnd,
	ignoreBookingId = null
}: {
	queryFn?: SqlQueryFn;
	locationId: number;
	windowStart: string;
	windowEnd: string;
	ignoreBookingId?: number | null;
}): Promise<RoomAvailabilityContext> {
	const normalizedLocationId = toInt(locationId);
	if (!normalizedLocationId) {
		return { rooms: [], bookings: [], roomBlocks: [] };
	}

	const roomRows = await queryFn(
		`
		SELECT id, location_id, name, half_hour_start, active
		FROM rooms
		WHERE location_id = $1
		  AND COALESCE(active, true) = true
		ORDER BY id ASC
		`,
		[normalizedLocationId]
	);

	const rooms: RoomAvailabilityRoom[] = roomRows.map((row) => ({
		id: Number(row.id),
		locationId: Number(row.location_id),
		name: row.name ?? '',
		halfHourStart: Boolean(row.half_hour_start),
		active: row.active ?? true
	}));

	if (rooms.length === 0) {
		return { rooms, bookings: [], roomBlocks: [] };
	}

	const roomIds = rooms.map((room) => room.id);

	const [bookingRows, roomBlockRows] = await Promise.all([
		queryFn(
			`
			SELECT id, room_id, start_time, status
			FROM bookings
			WHERE room_id = ANY($1::int[])
			  AND start_time >= $2
			  AND start_time < $3
			  AND ($4::int IS NULL OR id <> $4)
			  AND (status IS NULL OR LOWER(status) NOT IN ('cancelled', 'late_cancelled'))
			`,
			[roomIds, windowStart, windowEnd, ignoreBookingId]
		),
		queryFn(
			`
			SELECT id, room_id, start_time, end_time, reason, added_by_id
			FROM unavailable_rooms
			WHERE room_id = ANY($1::int[])
			  AND start_time < $3
			  AND end_time > $2
			`,
			[roomIds, windowStart, windowEnd]
		)
	]);

	return {
		rooms,
		bookings: bookingRows.map((row) => ({
			id: toInt(row.id),
			roomId: toInt(row.room_id),
			startTime: row.start_time,
			status: row.status ?? null
		})),
		roomBlocks: roomBlockRows.map((row) => ({
			id: toInt(row.id),
			roomId: toInt(row.room_id),
			startTime: row.start_time,
			endTime: row.end_time,
			reason: row.reason ?? null,
			addedById: toInt(row.added_by_id)
		}))
	};
}

export function evaluateRoomAvailabilityAtStart({
	context,
	startTime,
	preferredRoomId = null
}: {
	context: RoomAvailabilityContext;
	startTime: string | Date;
	preferredRoomId?: number | null;
}): RoomAvailabilityResult {
	const startEpoch = toEpoch(startTime);
	const parts = extractStockholmTimeParts(startTime);

	if (startEpoch === null || !parts) {
		return {
			startEpoch: null,
			sessionEndEpoch: null,
			matchingRoomIds: [],
			bookedRoomIds: [],
			blockedRoomIds: [],
			availableRoomIds: [],
			selectedRoomId: null
		};
	}

	const matchingRooms = context.rooms
		.filter((room) => room.active && roomMatchesMinute(room, parts.minute))
		.sort((left, right) => left.id - right.id);
	const sessionEndEpoch = startEpoch + HOUR_MS;

	const bookedRoomIds = new Set<number>();
	for (const booking of context.bookings) {
		const roomId = toInt(booking.roomId);
		const bookingStartEpoch = toEpoch(booking.startTime);
		if (!roomId || bookingStartEpoch === null) continue;
		if (!isActiveBookingStatus(booking.status)) continue;
		if (bookingStartEpoch === startEpoch) {
			bookedRoomIds.add(roomId);
		}
	}

	const blockedRoomIds = new Set<number>();
	for (const roomBlock of context.roomBlocks) {
		const roomId = toInt(roomBlock.roomId);
		const roomBlockStartEpoch = toEpoch(roomBlock.startTime);
		const roomBlockEndEpoch = toEpoch(roomBlock.endTime);
		if (!roomId || roomBlockStartEpoch === null || roomBlockEndEpoch === null) continue;
		if (roomBlockStartEpoch <= startEpoch && roomBlockEndEpoch >= sessionEndEpoch) {
			blockedRoomIds.add(roomId);
		}
	}

	const availableRooms = matchingRooms.filter(
		(room) => !bookedRoomIds.has(room.id) && !blockedRoomIds.has(room.id)
	);

	const normalizedPreferredRoomId = toInt(preferredRoomId);
	const selectedRoomId =
		availableRooms.find((room) => room.id === normalizedPreferredRoomId)?.id ??
		availableRooms[0]?.id ??
		null;

	return {
		startEpoch,
		sessionEndEpoch,
		matchingRoomIds: matchingRooms.map((room) => room.id),
		bookedRoomIds: Array.from(bookedRoomIds).sort((left, right) => left - right),
		blockedRoomIds: Array.from(blockedRoomIds).sort((left, right) => left - right),
		availableRoomIds: availableRooms.map((room) => room.id),
		selectedRoomId
	};
}

export async function findAvailableRoomForStart({
	queryFn = query as SqlQueryFn,
	locationId,
	startTime,
	ignoreBookingId = null,
	preferredRoomId = null
}: {
	queryFn?: SqlQueryFn;
	locationId: number;
	startTime: string | Date;
	ignoreBookingId?: number | null;
	preferredRoomId?: number | null;
}) {
	const parts = extractStockholmTimeParts(startTime);
	if (!parts) return null;

	const dateString = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
	const context = await loadLocationRoomAvailabilityContext({
		queryFn,
		locationId,
		windowStart: resolveDayStart(dateString),
		windowEnd: resolveNextDayStart(dateString),
		ignoreBookingId
	});

	return evaluateRoomAvailabilityAtStart({
		context,
		startTime,
		preferredRoomId
	});
}

export async function listCurrentOrFutureRoomBlocksForLocation(
	locationId: number,
	queryFn: SqlQueryFn = query as SqlQueryFn
) {
	const normalizedLocationId = toInt(locationId);
	if (!normalizedLocationId) {
		throw new RoomBlockHttpError(400, 'Ogiltig plats', {
			locationId: 'Ogiltigt plats-ID'
		});
	}

	const rows = await queryFn(
		`
		SELECT
			ur.*,
			r.name AS room_name,
			r.half_hour_start AS room_half_hour_start,
			u.firstname AS added_by_firstname,
			u.lastname AS added_by_lastname
		FROM unavailable_rooms ur
		JOIN rooms r ON r.id = ur.room_id
		LEFT JOIN users u ON u.id = ur.added_by_id
		WHERE r.location_id = $1
		  AND ur.end_time >= NOW()
		ORDER BY r.name ASC, ur.start_time ASC, ur.id ASC
		`,
		[normalizedLocationId]
	);

	return rows.map(mapCurrentOrFutureRoomBlock);
}

function buildCreatePayloads(input: RoomBlockMutationInput) {
	const roomId = toInt(input.roomId);
	const locationId = input.locationId == null ? null : toInt(input.locationId);
	const addedById = toInt(input.addedById);

	if (!roomId) {
		throw new RoomBlockHttpError(400, 'Rum krävs', {
			roomId: 'Välj ett rum'
		});
	}

	if (!addedById) {
		throw new RoomBlockHttpError(400, 'Användare saknas', {
			addedById: 'Inloggad användare kunde inte fastställas'
		});
	}

	const startDate = normalizeDateInput(input.startDate, 'startDate');
	const startTime = normalizeTimeInput(input.startTime, 'startTime');
	const endDate = normalizeDateInput(input.endDate, 'endDate');
	const endTime = normalizeTimeInput(input.endTime, 'endTime');
	const reason = normalizeReason(input.reason);

	assertValidRoomBlockRange(startDate, startTime, endDate, endTime);

	const repeatWeekly = normalizeBoolean(input.repeatWeekly);
	const repeatUntil =
		input.repeatUntil === null || input.repeatUntil === undefined || input.repeatUntil === ''
			? null
			: normalizeDateInput(input.repeatUntil, 'repeatUntil');

	if (repeatWeekly && !repeatUntil) {
		throw new RoomBlockHttpError(400, 'Slutdatum krävs', {
			repeatUntil: 'Ange sista datum för upprepningen'
		});
	}

	const payloads = [
		{
			roomId,
			locationId,
			startDate,
			startTime,
			endDate,
			endTime,
			reason,
			addedById
		}
	];

	if (repeatWeekly && repeatUntil) {
		let repeatStartDate = addDaysToDateString(startDate, 7);
		let repeatEndDate = addDaysToDateString(endDate, 7);

		while (compareDateStrings(repeatStartDate, repeatUntil) <= 0) {
			payloads.push({
				roomId,
				locationId,
				startDate: repeatStartDate,
				startTime,
				endDate: repeatEndDate,
				endTime,
				reason,
				addedById
			});
			repeatStartDate = addDaysToDateString(repeatStartDate, 7);
			repeatEndDate = addDaysToDateString(repeatEndDate, 7);
		}
	}

	return payloads;
}

export async function createRoomBlocks(
	input: RoomBlockMutationInput,
	queryFn: SqlQueryFn = query as SqlQueryFn
) {
	const payloads = buildCreatePayloads(input);

	for (const payload of payloads) {
		await ensureRoomExists(queryFn, payload.roomId, payload.locationId ?? null);
	}

	const insertedIds: number[] = [];
	for (const payload of payloads) {
		const insertedRows = await queryFn(
			`
			INSERT INTO unavailable_rooms (
				room_id,
				start_time,
				end_time,
				reason,
				added_by_id,
				created_at,
				updated_at
			)
			VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
			RETURNING id
			`,
			[
				payload.roomId,
				buildRoomBlockTimestamp(payload.startDate, payload.startTime),
				buildRoomBlockTimestamp(payload.endDate, payload.endTime),
				payload.reason,
				payload.addedById
			]
		);
		const insertedId = toInt(insertedRows[0]?.id);
		if (insertedId) insertedIds.push(insertedId);
	}

	return fetchRoomBlocksByIds(queryFn, insertedIds);
}

export async function updateRoomBlock(
	id: number,
	input: Omit<RoomBlockMutationInput, 'repeatWeekly' | 'repeatUntil'>,
	queryFn: SqlQueryFn = query as SqlQueryFn
) {
	const roomBlockId = toInt(id);
	const roomId = toInt(input.roomId);
	const locationId = input.locationId == null ? null : toInt(input.locationId);
	const addedById = toInt(input.addedById);

	if (!roomBlockId) {
		throw new RoomBlockHttpError(400, 'Ogiltig blockering', {
			id: 'Ogiltigt blockerings-ID'
		});
	}

	if (!roomId) {
		throw new RoomBlockHttpError(400, 'Rum krävs', {
			roomId: 'Välj ett rum'
		});
	}

	if (!addedById) {
		throw new RoomBlockHttpError(400, 'Användare saknas', {
			addedById: 'Inloggad användare kunde inte fastställas'
		});
	}

	const startDate = normalizeDateInput(input.startDate, 'startDate');
	const startTime = normalizeTimeInput(input.startTime, 'startTime');
	const endDate = normalizeDateInput(input.endDate, 'endDate');
	const endTime = normalizeTimeInput(input.endTime, 'endTime');
	const reason = normalizeReason(input.reason);

	assertValidRoomBlockRange(startDate, startTime, endDate, endTime);
	await ensureRoomExists(queryFn, roomId, locationId ?? null);

	const updatedRows = await queryFn(
		`
		UPDATE unavailable_rooms
		SET room_id = $1,
			start_time = $2,
			end_time = $3,
			reason = $4,
			added_by_id = $5,
			updated_at = NOW()
		WHERE id = $6
		RETURNING id
		`,
		[
			roomId,
			buildRoomBlockTimestamp(startDate, startTime),
			buildRoomBlockTimestamp(endDate, endTime),
			reason,
			addedById,
			roomBlockId
		]
	);

	if (!updatedRows.length) {
		throw new RoomBlockHttpError(404, 'Blockeringen hittades inte', {
			id: 'Blockeringen hittades inte'
		});
	}

	const updatedId = toInt(updatedRows[0]?.id);
	return updatedId ? (await fetchRoomBlocksByIds(queryFn, [updatedId]))[0] ?? null : null;
}

export async function deleteRoomBlock(id: number, queryFn: SqlQueryFn = query as SqlQueryFn) {
	const roomBlockId = toInt(id);
	if (!roomBlockId) {
		throw new RoomBlockHttpError(400, 'Ogiltig blockering', {
			id: 'Ogiltigt blockerings-ID'
		});
	}

	const deletedRows = await queryFn(`DELETE FROM unavailable_rooms WHERE id = $1 RETURNING id`, [
		roomBlockId
	]);

	if (!deletedRows.length) {
		throw new RoomBlockHttpError(404, 'Blockeringen hittades inte', {
			id: 'Blockeringen hittades inte'
		});
	}

	return { id: roomBlockId };
}
