import { query } from '$lib/db';
import type { RequestHandler } from '@sveltejs/kit';

function extractTimeInMinutes(date: Date): number {
	return date.getHours() * 60 + date.getMinutes();
}

function extractTime(timeStr: string): number {
	const [h, m] = timeStr.split(':').map(Number);
	return h * 60 + m;
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
	return startA < endB && startB < endA;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { date, trainerId, locationId, checkUsersBusy = false, userId = null } = body;

	if (!date || !trainerId || !locationId) {
		return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
	}

	const dayStart = `${date} 00:00:00`;
	const dayEnd = `${date} 23:59:59`;
	const targetDate = new Date(date);
	const today = new Date();
	const oneWeekAhead = new Date(today);
	oneWeekAhead.setDate(today.getDate() + 7);

	// 1. Absences (same)
	if (targetDate <= oneWeekAhead) {
		const absences = await query(
			`SELECT 1 FROM absences 
       WHERE user_id = $1 AND (
         (start_time <= $2 AND end_time >= $2)
         OR (start_time <= $2 AND end_time IS NULL)
       )`,
			[trainerId, date]
		);
		if (absences.length > 0) {
			return new Response(JSON.stringify({ availableSlots: [], outsideAvailabilitySlots: [] }));
		}
	}

	// 2. Vacations (same)
	const vacations = await query(
		`SELECT 1 FROM vacations
     WHERE user_id = $1 AND start_date <= $2 AND end_date >= $2`,
		[trainerId, date]
	);
	if (vacations.length > 0) {
		return new Response(JSON.stringify({ availableSlots: [], outsideAvailabilitySlots: [] }));
	}

	// 3. Date or Weekly Availability (same)
	const dateAvailabilities = await query(
		`SELECT start_time, end_time FROM date_availabilities
     WHERE user_id = $1 AND date = $2 AND available = true`,
		[trainerId, date]
	);

	let availability = dateAvailabilities.map((a) => ({
		from: extractTime(a.start_time),
		to: extractTime(a.end_time)
	}));

	if (availability.length === 0) {
		const weekday = ((targetDate.getDay() + 6) % 7) + 1;
		const weekly = await query(
			`SELECT start_time, end_time FROM weekly_availabilities WHERE user_id = $1 AND weekday = $2`,
			[trainerId, weekday]
		);
		availability = weekly.map((a) => ({
			from: extractTime(a.start_time),
			to: extractTime(a.end_time)
		}));

		if (availability.length === 0) {
			availability = [{ from: 0, to: 24 * 60 }];
		}
	}

	// 4. Active rooms (same)
	const rooms = await query(`SELECT id FROM rooms WHERE location_id = $1 AND active = true`, [
		locationId
	]);
	const roomIds = rooms.map((r) => r.id);
	if (roomIds.length === 0) {
		return new Response(JSON.stringify({ availableSlots: [], outsideAvailabilitySlots: [] }));
	}

	// 5. Bookings in those rooms (same)
	const bookings = await query(
		`SELECT room_id, start_time FROM bookings
     WHERE start_time BETWEEN $1 AND $2
       AND status != 'Cancelled'
       AND room_id = ANY($3::int[])`,
		[dayStart, dayEnd, roomIds]
	);

	// 6. Trainer personal bookings (same)
	const personalBookings = await query(
		`SELECT start_time, end_time FROM personal_bookings
     WHERE start_time BETWEEN $1 AND $2
       AND (user_id = $3 OR $3 = ANY(user_ids))`,
		[dayStart, dayEnd, trainerId]
	);

	const trainerPersonalIntervals: { start: number; end: number }[] = personalBookings.map(
		(row: any) => ({
			start: extractTimeInMinutes(new Date(row.start_time)),
			end: extractTimeInMinutes(new Date(row.end_time))
		})
	);

	// 7. NEW: Trainee’s busy intervals (only when asked)
	let traineeIntervals: { start: number; end: number }[] = [];
	if (checkUsersBusy && userId) {
		const [traineePersonal, traineePractice] = await Promise.all([
			query(
				`SELECT start_time, end_time FROM personal_bookings
         WHERE start_time BETWEEN $1 AND $2
           AND (user_id = $3 OR $3 = ANY(user_ids))`,
				[dayStart, dayEnd, userId]
			),
			query(
				`SELECT start_time FROM bookings
         WHERE start_time BETWEEN $1 AND $2
           AND status != 'Cancelled'
           AND user_id = $3`,
				[dayStart, dayEnd, userId]
			)
		]);

		traineeIntervals = [
			...traineePersonal.map((row: any) => ({
				start: extractTimeInMinutes(new Date(row.start_time)),
				end: extractTimeInMinutes(new Date(row.end_time))
			})),
			...traineePractice.map((row: any) => {
				const s = extractTimeInMinutes(new Date(row.start_time));
				return { start: s, end: s + 60 }; // bookings table has 60-min slots
			})
		];
	}

	const availableSlots: string[] = [];
	const outsideAvailabilitySlots: string[] = [];

	for (let h = 5; h <= 21; h++) {
		for (const m of [30]) {
			const slotStart = h * 60 + m;
			const slotEnd = slotStart + 60;
			const label = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

			// room capacity
			const bookedRoomIdsAtThisSlot = new Set(
				bookings
					.filter((b) => {
						const bookingStart = extractTimeInMinutes(new Date(b.start_time));
						const bookingEnd = bookingStart + 60;
						return overlaps(slotStart, slotEnd, bookingStart, bookingEnd);
					})
					.map((b) => b.room_id)
			);
			if (bookedRoomIdsAtThisSlot.size === roomIds.length) continue;

			// trainer availability window
			const insideAvailability = availability.some((a) =>
				overlaps(slotStart, slotEnd, a.from, a.to)
			);
			if (!insideAvailability) {
				outsideAvailabilitySlots.push(label);
				continue;
			}

			// trainer personal / meetings
			const trainerConflict = trainerPersonalIntervals.some((b) =>
				overlaps(slotStart, slotEnd, b.start, b.end)
			);
			if (trainerConflict) continue;

			// NEW: trainee conflicts (only when asked)
			if (checkUsersBusy && userId) {
				const traineeConflict = traineeIntervals.some((b) =>
					overlaps(slotStart, slotEnd, b.start, b.end)
				);
				if (traineeConflict) continue;
			}

			availableSlots.push(label);
		}
	}

	return new Response(
		JSON.stringify({
			availableSlots,
			outsideAvailabilitySlots
		})
	);
};
