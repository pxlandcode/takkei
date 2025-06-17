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
	const { date, trainerId, locationId, roomId } = await request.json();

	if (!date || !trainerId || !locationId || !roomId) {
		console.warn('Missing parameters');
		return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
	}

	const dayStart = `${date} 00:00:00`;
	const dayEnd = `${date} 23:59:59`;

	const targetDate = new Date(date);
	const today = new Date();
	const oneWeekAhead = new Date(today);
	oneWeekAhead.setDate(today.getDate() + 7);

	// ✅ Absence (if within one week)
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
			console.log('Trainer is absent:', absences);
			return new Response(JSON.stringify({ availableSlots: [] }));
		}
	}

	// ✅ Vacation check
	const vacations = await query(
		`SELECT * FROM vacations
		 WHERE user_id = $1 AND start_date <= $2 AND end_date >= $2`,
		[trainerId, date]
	);
	if (vacations.length > 0) {
		console.log('Trainer is on vacation:', vacations);
		return new Response(JSON.stringify({ availableSlots: [] }));
	}

	// ✅ Date-specific availability
	const dateAvailabilities = await query(
		`SELECT * FROM date_availabilities
		 WHERE user_id = $1 AND date = $2 AND available = true`,
		[trainerId, date]
	);

	let availability = dateAvailabilities.map((a) => ({
		from: extractTime(a.start_time),
		to: extractTime(a.end_time)
	}));

	// ✅ Weekly fallback if no date-specific
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

	// ✅ Bookings and Personal Bookings
	const bookings = await query(
		`SELECT id, start_time, location_id FROM bookings
		 WHERE start_time BETWEEN $1 AND $2 AND status != 'Cancelled'
		 AND (trainer_id = $3 OR room_id = $4)`,
		[dayStart, dayEnd, trainerId, roomId]
	);

	const personalBookings = await query(
		`SELECT start_time, end_time FROM personal_bookings
		 WHERE start_time BETWEEN $1 AND $2
		 AND (user_id = $3 OR $3 = ANY(user_ids))`,
		[dayStart, dayEnd, trainerId]
	);

	const travelBuffer = 15;
	const blockedIntervals: { start: number; end: number }[] = [];

	for (const row of bookings) {
		const start = extractTimeInMinutes(new Date(row.start_time));
		const end = start + 60;

		if (row.location_id !== locationId) {
			blockedIntervals.push({ start: start - travelBuffer, end: end + travelBuffer });
		} else {
			blockedIntervals.push({ start, end });
		}
	}

	for (const row of personalBookings) {
		const start = extractTimeInMinutes(new Date(row.start_time));
		const end = extractTimeInMinutes(new Date(row.end_time));
		blockedIntervals.push({ start, end });
	}

	const availableSlots: string[] = [];
	const outsideAvailabilitySlots: string[] = [];

	for (let h = 5; h <= 21; h++) {
		for (const m of [0, 30]) {
			const slotStart = h * 60 + m;
			const slotEnd = slotStart + 60;
			const label = `${h.toString().padStart(2, '0')}:${m === 0 ? '00' : '30'}`;

			const hasConflict = blockedIntervals.some((b) =>
				overlaps(slotStart, slotEnd, b.start, b.end)
			);

			const overlapsAvailability = availability.some((a) =>
				overlaps(slotStart, slotEnd, a.from, a.to)
			);

			if (hasConflict) continue;

			if (overlapsAvailability) {
				availableSlots.push(label);
			} else {
				outsideAvailabilitySlots.push(label);
			}
		}
	}

	return new Response(
		JSON.stringify({
			availableSlots,
			outsideAvailabilitySlots
		})
	);
};
