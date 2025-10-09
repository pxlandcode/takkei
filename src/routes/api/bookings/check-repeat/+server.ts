import { query } from '$lib/db';
import { extractStockholmMinutes } from '$lib/server/stockholm-time';
import type { RequestHandler } from '@sveltejs/kit';

type Interval = { start: number; end: number };
type RoomInterval = Interval & { roomId: number | null };

const SLOT_LENGTH_MINUTES = 60;

function extractTimeInMinutes(timeStr: string): number {
	const [h, m] = timeStr.split(':').map(Number);
	return h * 60 + m;
}
function isNotNull<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}
function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
	return startA < endB && startB < endA;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const {
		date,
		trainerId,
		locationId,
		time,
		repeatWeeks,
		checkUsersBusy = false,
		userId = null
	} = body;

	if (!date || !trainerId || !locationId || !time || !repeatWeeks) {
		return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
	}

	const baseDate = new Date(date);
	const slotStart = extractTimeInMinutes(time);
	const slotEnd = slotStart + SLOT_LENGTH_MINUTES;

	const repeatedBookings = [];

	// rooms at location
	const roomResult = await query(`SELECT id FROM rooms WHERE location_id = $1 AND active = true`, [
		locationId
	]);
	const roomIds: number[] = roomResult.map((r: any) => r.id);
	if (roomIds.length === 0) {
		return new Response(JSON.stringify({ error: 'No rooms at this location' }), { status: 400 });
	}

	for (let i = 0; i < repeatWeeks; i++) {
		const checkDate = new Date(baseDate);
		checkDate.setDate(baseDate.getDate() + i * 7);
		const dateString = checkDate.toISOString().split('T')[0];
		const dayStart = `${dateString} 00:00:00`;
		const dayEnd = `${dateString} 23:59:59`;

		// room bookings
		const bookings = await query(
			`
        SELECT room_id, start_time
        FROM bookings
        WHERE start_time BETWEEN $1 AND $2
          AND LOWER(status) NOT IN ('cancelled', 'late_cancelled')
          AND room_id = ANY($3::int[])
      `,
			[dayStart, dayEnd, roomIds]
		);

		// trainer personal bookings
		const personalBookings = await query(
			`
        SELECT start_time, end_time
        FROM personal_bookings
        WHERE start_time BETWEEN $1 AND $2
          AND (user_id = $3 OR $3 = ANY(user_ids))
      `,
			[dayStart, dayEnd, trainerId]
		);
		const trainerPersonalIntervals: Interval[] = personalBookings
			.map((b: any): Interval | null => {
				const start = extractStockholmMinutes(b.start_time);
				const end = extractStockholmMinutes(b.end_time);
				if (start === null || end === null) return null;
				return { start, end };
			})
			.filter(isNotNull);

		const bookingIntervals: RoomInterval[] = bookings
			.map((b: any): RoomInterval | null => {
				const start = extractStockholmMinutes(b.start_time);
				if (start === null) return null;
				return {
					start,
					end: start + SLOT_LENGTH_MINUTES,
					roomId: b.room_id === null ? null : Number(b.room_id)
				};
			})
			.filter(isNotNull);

		// NEW: check trainer & trainee "user-busy" windows (only if asked)
		let trainerBookingIntervals: Interval[] = [];
		let traineePersonalIntervals: Interval[] = [];
		let traineeBookingIntervals: Interval[] = [];

		if (checkUsersBusy) {
			// Trainer's existing client/practice bookings
			const tBookings = await query(
				`
          SELECT start_time
          FROM bookings
          WHERE start_time BETWEEN $1 AND $2
            AND LOWER(status) NOT IN ('cancelled', 'late_cancelled')
            AND trainer_id = $3
        `,
				[dayStart, dayEnd, trainerId]
			);
			trainerBookingIntervals = tBookings
				.map((b: any): Interval | null => {
					const start = extractStockholmMinutes(b.start_time);
					if (start === null) return null;
					return { start, end: start + SLOT_LENGTH_MINUTES };
				})
				.filter(isNotNull);

			if (userId) {
				// Trainee personal bookings
				const traineePersonal = await query(
					`
            SELECT start_time, end_time
            FROM personal_bookings
            WHERE start_time BETWEEN $1 AND $2
              AND (user_id = $3 OR $3 = ANY(user_ids))
          `,
					[dayStart, dayEnd, userId]
				);
				traineePersonalIntervals = traineePersonal
					.map((b: any): Interval | null => {
						const start = extractStockholmMinutes(b.start_time);
						const end = extractStockholmMinutes(b.end_time);
						if (start === null || end === null) return null;
						return { start, end };
					})
					.filter(isNotNull);

				// Trainee practice bookings (bookings.user_id = trainee)
				const traineeBookings = await query(
					`
            SELECT start_time
            FROM bookings
            WHERE start_time BETWEEN $1 AND $2
              AND LOWER(status) NOT IN ('cancelled', 'late_cancelled')
              AND user_id = $3
          `,
					[dayStart, dayEnd, userId]
				);
				traineeBookingIntervals = traineeBookings
					.map((b: any): Interval | null => {
						const start = extractStockholmMinutes(b.start_time);
						if (start === null) return null;
						return { start, end: start + SLOT_LENGTH_MINUTES };
					})
					.filter(isNotNull);
			}
		}

		// room conflicts
		const roomConflicts = new Set(
			bookingIntervals
				.filter((booking) => overlaps(slotStart, slotEnd, booking.start, booking.end))
				.map((booking) => booking.roomId)
		);
		const allRoomsTaken = roomConflicts.size >= roomIds.length;

		// user conflicts
		const trainerBusy = [...trainerPersonalIntervals, ...trainerBookingIntervals];
		const traineeBusy = [...traineePersonalIntervals, ...traineeBookingIntervals];

		const trainerConflict = trainerBusy.some((b) => overlaps(slotStart, slotEnd, b.start, b.end));
		const traineeConflict = traineeBusy.some((b) => overlaps(slotStart, slotEnd, b.start, b.end));

		const hasConflict = allRoomsTaken || trainerConflict || traineeConflict;

		// Suggestions
		let suggestedTimes: string[] = [];
		if (hasConflict) {
			for (let h = 5; h <= 21; h++) {
				for (let m of [0, 30]) {
					const altStart = h * 60 + m;
					const altEnd = altStart + SLOT_LENGTH_MINUTES;

					const altRoomConflicts = new Set(
						bookingIntervals
							.filter((booking) => overlaps(altStart, altEnd, booking.start, booking.end))
							.map((booking) => booking.roomId)
					);
					const altTrainer = trainerBusy.some((b) => overlaps(altStart, altEnd, b.start, b.end));
					const altTrainee = traineeBusy.some((b) => overlaps(altStart, altEnd, b.start, b.end));

					if (altRoomConflicts.size < roomIds.length && !altTrainer && !altTrainee) {
						suggestedTimes.push(`${h.toString().padStart(2, '0')}:${m === 0 ? '00' : '30'}`);
					}
				}
			}
		}

		repeatedBookings.push({
			week: i + 1,
			date: dateString,
			time,
			conflict: hasConflict,
			suggestedTimes
		});
	}

	return new Response(JSON.stringify({ success: true, repeatedBookings }));
};
