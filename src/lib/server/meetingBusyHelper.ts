import { query } from '$lib/db';
import { extractStockholmMinutes } from '$lib/server/stockholm-time';

export type BusyBlock = { start: number; end: number; userIds: number[] };

const DEFAULT_BOOKING_MINUTES = 60;

function normalizeUserIds(userIds: number[] = []): number[] {
	return Array.from(new Set(userIds.filter((id) => Number.isFinite(id))));
}

export async function fetchBusyBlocksForUsers(
	dateString: string,
	userIds: number[]
): Promise<BusyBlock[]> {
	const normalizedIds = normalizeUserIds(userIds);
	if (normalizedIds.length === 0) return [];

	const dayStart = `${dateString} 00:00:00`;
	const dayEnd = `${dateString} 23:59:59`;
	const placeholders = normalizedIds.map((_, idx) => `$${idx + 3}`).join(',');
	const values = [dayStart, dayEnd, ...normalizedIds];

	const [personalBookings, standardBookings] = await Promise.all([
		query(
			`
        SELECT id, user_id, user_ids, start_time, end_time
        FROM personal_bookings
        WHERE (start_time < $2 AND end_time > $1)
        AND (
          user_id = ANY(ARRAY[${placeholders}]::int[]) OR
          ARRAY[${placeholders}]::int[] && user_ids
        )
      `,
			values
		),
		query(
			`
        SELECT trainer_id, user_id, start_time
        FROM bookings
        WHERE start_time BETWEEN $1 AND $2
        AND LOWER(status) NOT IN ('cancelled', 'late_cancelled')
        AND (
          trainer_id = ANY(ARRAY[${placeholders}]::int[])
          OR user_id = ANY(ARRAY[${placeholders}]::int[])
        )
      `,
			values
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
