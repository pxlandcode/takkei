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
	const { date, trainerId, locationId } = await request.json();

	if (!date || !trainerId || !locationId) {
		return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
	}

	const dayStart = `${date} 00:00:00`;
	const dayEnd = `${date} 23:59:59`;
	const targetDate = new Date(date);
	const today = new Date();
	const oneWeekAhead = new Date(today);
	oneWeekAhead.setDate(today.getDate() + 7);

	// 1. Absences
	if (targetDate <= oneWeekAhead) {
		const absences = await query(
			`SELECT * FROM absences 
			 WHERE user_id = $1 AND (
				(start_time <= $2 AND end_time >= $2)
				OR (start_time <= $2 AND end_time IS NULL)
			)`,
			[trainerId, date]
		);
		if (absences.length > 0) {
			return new Response(JSON.stringify({ availableSlots: [] }));
		}
	}

	// 2. Vacations
	const vacations = await query(
		`SELECT * FROM vacations
		 WHERE user_id = $1 AND start_date <= $2 AND end_date >= $2`,
		[trainerId, date]
	);
	if (vacations.length > 0) {
		return new Response(JSON.stringify({ availableSlots: [] }));
	}

	// 3. Date or Weekly Availability
	const dateAvailabilities = await query(
		`SELECT * FROM date_availabilities
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
			`SELECT * FROM weekly_availabilities WHERE user_id = $1 AND weekday = $2`,
			[trainerId, weekday]
		);
		availability = weekly.map((a) => ({
			from: extractTime(a.start_time),
			to: extractTime(a.end_time)
		}));
	}

	// 4. Get all active rooms for the location
	const rooms = await query(`SELECT id FROM rooms WHERE location_id = $1 AND active = true`, [
		locationId
	]);
	const roomIds = rooms.map((r) => r.id);

	if (roomIds.length === 0) {
		return new Response(JSON.stringify({ availableSlots: [] }));
	}

	// 5. Get bookings for those rooms
	const bookings = await query(
		`SELECT room_id, start_time FROM bookings
		 WHERE start_time BETWEEN $1 AND $2
		 AND status != 'Cancelled'
		 AND room_id = ANY($3::int[])`,
		[dayStart, dayEnd, roomIds]
	);

	// 6. Get personal bookings (same logic as before)
	const personalBookings = await query(
		`SELECT start_time, end_time FROM personal_bookings
		 WHERE start_time BETWEEN $1 AND $2
		 AND (user_id = $3 OR $3 = ANY(user_ids))`,
		[dayStart, dayEnd, trainerId]
	);

	const personalBookingIntervals: { start: number; end: number }[] = [];

	for (const row of personalBookings) {
		const start = extractTimeInMinutes(new Date(row.start_time));
		const end = extractTimeInMinutes(new Date(row.end_time));
		personalBookingIntervals.push({ start, end });
	}

	const availableSlots: string[] = [];
	const outsideAvailabilitySlots: string[] = [];

	for (let h = 5; h <= 21; h++) {
		for (const m of [30]) {
			const slotStart = h * 60 + m;
			const slotEnd = slotStart + 60;
			const label = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

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

			const overlapsTrainer = availability.some((a) => overlaps(slotStart, slotEnd, a.from, a.to));
			if (!overlapsTrainer) {
				outsideAvailabilitySlots.push(label);
				continue;
			}

			const trainerConflict = personalBookingIntervals.some((b) =>
				overlaps(slotStart, slotEnd, b.start, b.end)
			);
			if (trainerConflict) continue;

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
