import { query } from '$lib/db';
import { extractStockholmMinutes, extractStockholmTimeParts } from '$lib/server/stockholm-time';

export type BusyBlock = { start: number; end: number; userIds: number[] };

const DEFAULT_BOOKING_MINUTES = 60;

function normalizeUserIds(userIds: number[] = []): number[] {
	return Array.from(new Set(userIds.filter((id) => Number.isFinite(id))));
}

function pad2(value: number): string {
	return String(value).padStart(2, '0');
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
	return startA < endB && startB < endA;
}

export async function fetchBusyBlocksForUsers(
	dateString: string,
	userIds: number[],
	options: { ignorePersonalBookingId?: number } = {}
): Promise<BusyBlock[]> {
	const normalizedIds = normalizeUserIds(userIds);
	if (normalizedIds.length === 0) return [];

	const ignorePersonalBookingId =
		typeof options.ignorePersonalBookingId === 'number' &&
		Number.isFinite(options.ignorePersonalBookingId)
			? options.ignorePersonalBookingId
			: null;

	const dayStart = `${dateString} 00:00:00`;
	const dayEnd = `${dateString} 23:59:59`;
	const standardPlaceholders = normalizedIds.map((_, idx) => `$${idx + 3}`).join(',');
	const standardValues = [dayStart, dayEnd, ...normalizedIds];

	let personalValues = standardValues;
	let personalPlaceholders = standardPlaceholders;
	let ignoreClause = '';
	if (ignorePersonalBookingId !== null) {
		ignoreClause = `AND id <> $3`;
		personalPlaceholders = normalizedIds.map((_, idx) => `$${idx + 4}`).join(',');
		personalValues = [dayStart, dayEnd, ignorePersonalBookingId, ...normalizedIds];
	}

	const [personalBookings, standardBookings] = await Promise.all([
		query(
			`
        SELECT id, user_id, user_ids, start_time, end_time
        FROM personal_bookings
        WHERE (start_time < $2 AND end_time > $1)
        ${ignoreClause}
        AND (
          user_id = ANY(ARRAY[${personalPlaceholders}]::int[]) OR
          ARRAY[${personalPlaceholders}]::int[] && user_ids
        )
      `,
			personalValues
		),
		query(
			`
        SELECT trainer_id, user_id, start_time
        FROM bookings
        WHERE start_time BETWEEN $1 AND $2
        AND LOWER(status) NOT IN ('cancelled', 'late_cancelled')
        AND (
          trainer_id = ANY(ARRAY[${standardPlaceholders}]::int[])
          OR user_id = ANY(ARRAY[${standardPlaceholders}]::int[])
        )
      `,
			standardValues
		)
	]);

	const busyBlocks: BusyBlock[] = [];

	for (const booking of personalBookings) {
		const start = extractStockholmMinutes(booking.start_time);
		const end = extractStockholmMinutes(booking.end_time);
		if (start === null || end === null) continue;

		const affectedUsers = new Set<number>();
		if (booking.user_id && normalizedIds.includes(booking.user_id)) {
			affectedUsers.add(booking.user_id);
		}
		if (Array.isArray(booking.user_ids)) {
			for (const uid of booking.user_ids) {
				if (normalizedIds.includes(uid)) {
					affectedUsers.add(uid);
				}
			}
		}

		if (affectedUsers.size > 0) {
			busyBlocks.push({
				start,
				end,
				userIds: Array.from(affectedUsers)
			});
		}
	}

	for (const booking of standardBookings) {
		const start = extractStockholmMinutes(booking.start_time);
		if (start === null) continue;

		const affectedUsers = new Set<number>();
		if (booking.trainer_id && normalizedIds.includes(booking.trainer_id)) {
			affectedUsers.add(booking.trainer_id);
		}
		if (booking.user_id && normalizedIds.includes(booking.user_id)) {
			affectedUsers.add(booking.user_id);
		}

		if (affectedUsers.size > 0) {
			busyBlocks.push({
				start,
				end: start + DEFAULT_BOOKING_MINUTES,
				userIds: Array.from(affectedUsers)
			});
		}
	}

	return busyBlocks;
}

export async function findConflictingUsersForTimeRange({
	startTime,
	endTime,
	userIds,
	ignorePersonalBookingId
}: {
	startTime: string;
	endTime: string;
	userIds: number[];
	ignorePersonalBookingId?: number;
}): Promise<number[] | null> {
	const normalizedIds = normalizeUserIds(userIds);
	if (normalizedIds.length === 0) return [];

	const startParts = extractStockholmTimeParts(startTime);
	const startMinutes = extractStockholmMinutes(startTime);
	const endMinutes = extractStockholmMinutes(endTime);

	if (!startParts || startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
		return null;
	}

	const dateString = `${startParts.year}-${pad2(startParts.month)}-${pad2(startParts.day)}`;
	const busyBlocks = await fetchBusyBlocksForUsers(dateString, normalizedIds, {
		ignorePersonalBookingId
	});

	const conflictingUserIds = new Set<number>();
	for (const block of busyBlocks) {
		const isAdjacent =
			Math.abs(endMinutes - block.start) <= 1 || Math.abs(startMinutes - block.end) <= 1;

		if (!isAdjacent && overlaps(startMinutes, endMinutes, block.start, block.end)) {
			block.userIds.forEach((uid) => conflictingUserIds.add(uid));
		}
	}

	return Array.from(conflictingUserIds);
}
