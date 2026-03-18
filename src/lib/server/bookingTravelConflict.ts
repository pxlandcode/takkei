import { extractStockholmMinutes, extractStockholmTimeParts } from '$lib/server/stockholm-time';

export const SLOT_LENGTH_MINUTES = 60;
export const TRAVEL_BUFFER_MINUTES = 25;

type QueryFn = <T = any>(text: string, params?: unknown[]) => Promise<T[]>;

type TravelConflictRow = {
	id: number;
	start_time: string | Date;
	location_id: number | null;
};

export type TravelConflict = {
	conflictingBookingId: number;
	conflictingStartTime: string | Date;
	conflictingLocationId: number | null;
};

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
	return startA < endB && startB < endA;
}

function hasTravelConflict(
	targetStartMinutes: number,
	targetLocationId: number,
	booking: TravelConflictRow
): boolean {
	if (booking.location_id === null || booking.location_id === targetLocationId) return false;

	const existingStartMinutes = extractStockholmMinutes(booking.start_time);
	if (existingStartMinutes === null) return false;

	const targetEndMinutes = targetStartMinutes + SLOT_LENGTH_MINUTES;
	const existingEndMinutes = existingStartMinutes + SLOT_LENGTH_MINUTES;

	if (overlaps(targetStartMinutes, targetEndMinutes, existingStartMinutes, existingEndMinutes)) {
		return true;
	}

	if (existingEndMinutes <= targetStartMinutes) {
		return targetStartMinutes - existingEndMinutes < TRAVEL_BUFFER_MINUTES;
	}

	if (existingStartMinutes >= targetEndMinutes) {
		return existingStartMinutes - targetEndMinutes < TRAVEL_BUFFER_MINUTES;
	}

	return false;
}

export function findTravelConflictForBooking({
	targetStartTime,
	targetLocationId,
	bookings
}: {
	targetStartTime: string | Date;
	targetLocationId: number;
	bookings: TravelConflictRow[];
}): TravelConflict | null {
	const targetStartMinutes = extractStockholmMinutes(targetStartTime);
	if (targetStartMinutes === null) return null;

	for (const booking of bookings) {
		if (!hasTravelConflict(targetStartMinutes, targetLocationId, booking)) {
			continue;
		}

		return {
			conflictingBookingId: booking.id,
			conflictingStartTime: booking.start_time,
			conflictingLocationId: booking.location_id
		};
	}

	return null;
}

export async function findUserTravelConflict({
	queryFn,
	userId,
	targetStartTime,
	targetLocationId,
	ignoreBookingId = null
}: {
	queryFn: QueryFn;
	userId: number | null;
	targetStartTime: string | Date | null;
	targetLocationId: number | null;
	ignoreBookingId?: number | null;
}): Promise<TravelConflict | null> {
	if (!userId || !targetStartTime || !targetLocationId) {
		return null;
	}

	const timeParts = extractStockholmTimeParts(targetStartTime);
	if (!timeParts) return null;

	const ymd = `${timeParts.year}-${String(timeParts.month).padStart(2, '0')}-${String(timeParts.day).padStart(2, '0')}`;

	const rows = await queryFn<TravelConflictRow>(
		`
		SELECT id, start_time, location_id
		FROM bookings
		WHERE start_time BETWEEN $1 AND $2
		  AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'late_cancelled')
		  AND (
			trainer_id = $3
			OR (user_id = $3 AND (internal_education = true OR education = true))
		  )
		  AND ($4::int IS NULL OR id <> $4)
		ORDER BY start_time ASC
		`,
		[`${ymd} 00:00:00`, `${ymd} 23:59:59`, userId, ignoreBookingId]
	);

	return findTravelConflictForBooking({
		targetStartTime,
		targetLocationId,
		bookings: rows
	});
}

export const findTrainerTravelConflict = findUserTravelConflict;
