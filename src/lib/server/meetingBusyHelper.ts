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

function parseTimeDirectly(timeStr: string): number | null {
	const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
	if (!timeMatch) return null;
	const hours = parseInt(timeMatch[1], 10);
	const minutes = parseInt(timeMatch[2], 10);
	if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
	return hours * 60 + minutes;
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

	console.log('🔍 findConflictingUsersForTimeRange called');
	console.log('  Input startTime:', startTime);
	console.log('  Input endTime:', endTime);
	console.log('  userIds:', userIds);

	// Try to parse times directly first (for timestamps from frontend like "2026-03-20T16:30:00")
	let startMinutes = parseTimeDirectly(startTime);
	let endMinutes = parseTimeDirectly(endTime);

	// If direct parsing worked, we have the times in the correct timezone
	if (startMinutes !== null && endMinutes !== null) {
		console.log('  ✅ Parsed times directly (no timezone conversion)');
		console.log(
			'  Extracted startMinutes:',
			startMinutes,
			'(',
			Math.floor(startMinutes / 60) + ':' + (startMinutes % 60).toString().padStart(2, '0'),
			')'
		);
		console.log(
			'  Extracted endMinutes:',
			endMinutes,
			'(',
			Math.floor(endMinutes / 60) + ':' + (endMinutes % 60).toString().padStart(2, '0'),
			')'
		);
	} else {
		// Fallback to Stockholm extraction for database timestamps
		console.log('  Using Stockholm time extraction for database timestamps');
		startMinutes = extractStockholmMinutes(startTime);
		endMinutes = extractStockholmMinutes(endTime);
		console.log(
			'  Extracted startMinutes:',
			startMinutes,
			'(',
			Math.floor(startMinutes / 60) + ':' + (startMinutes % 60).toString().padStart(2, '0'),
			')'
		);
		console.log(
			'  Extracted endMinutes:',
			endMinutes,
			'(',
			Math.floor(endMinutes / 60) + ':' + (endMinutes % 60).toString().padStart(2, '0'),
			')'
		);
	}

	const startParts = extractStockholmTimeParts(startTime);

	if (!startParts || startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
		console.log('  ❌ Invalid time range');
		return null;
	}

	const dateString = `${startParts.year}-${pad2(startParts.month)}-${pad2(startParts.day)}`;
	console.log('  dateString:', dateString);

	const busyBlocks = await fetchBusyBlocksForUsers(dateString, normalizedIds, {
		ignorePersonalBookingId
	});

	console.log('  Found', busyBlocks.length, 'busy blocks');
	busyBlocks.forEach((block, idx) => {
		const blockStartTime =
			Math.floor(block.start / 60) + ':' + (block.start % 60).toString().padStart(2, '0');
		const blockEndTime =
			Math.floor(block.end / 60) + ':' + (block.end % 60).toString().padStart(2, '0');
		console.log(
			`    Block ${idx}: ${blockStartTime}-${blockEndTime} (${block.start}-${block.end} mins), userIds: ${block.userIds}`
		);
	});

	const conflictingUserIds = new Set<number>();
	for (const block of busyBlocks) {
		const isAdjacent =
			Math.abs(endMinutes - block.start) <= 1 || Math.abs(startMinutes - block.end) <= 1;

		const overlapsCheck = overlaps(startMinutes, endMinutes, block.start, block.end);

		console.log(
			`    Checking block [${block.start}-${block.end}]: overlaps=${overlapsCheck}, isAdjacent=${isAdjacent}`
		);
		console.log(
			`      endMinutes(${endMinutes}) - block.start(${block.start}) = ${Math.abs(endMinutes - block.start)}`
		);
		console.log(
			`      startMinutes(${startMinutes}) - block.end(${block.end}) = ${Math.abs(startMinutes - block.end)}`
		);

		if (!isAdjacent && overlapsCheck) {
			console.log(`      ❌ CONFLICT found for users: ${block.userIds}`);
			block.userIds.forEach((uid) => conflictingUserIds.add(uid));
		} else if (isAdjacent && overlapsCheck) {
			console.log(`      ✅ Adjacent bookings allowed (no conflict)`);
		}
	}

	console.log('  Final conflicting users:', Array.from(conflictingUserIds));
	return Array.from(conflictingUserIds);
}
