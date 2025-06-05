import { query } from '$lib/db';
import type { RequestHandler } from '@sveltejs/kit';

function extractTimeInMinutes(date: Date): number {
	return date.getHours() * 60 + date.getMinutes();
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
	// Closed-open interval logic: [start, end)
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

	const bookings = await query(
		`
      SELECT id, start_time, location_id
      FROM bookings
      WHERE start_time BETWEEN $1 AND $2
        AND status != 'Cancelled'
        AND (
          trainer_id = $3
          OR room_id = $4
        )
    `,
		[dayStart, dayEnd, trainerId, roomId]
	);

	const travelBuffer = 15; // minutes required between locations
	const blockedIntervals: { start: number; end: number }[] = [];

	for (const row of bookings) {
		const start = extractTimeInMinutes(row.start_time);
		const end = start + 60;

		if (row.location_id !== locationId) {
			// Booking is at a different location → add buffer before and after
			blockedIntervals.push({ start: start - travelBuffer, end: end + travelBuffer });
		} else {
			blockedIntervals.push({ start, end });
		}
	}

	// Fetch personal bookings where the trainer is involved
	const personalBookings = await query(
		`
      SELECT id, start_time, end_time
      FROM personal_bookings
      WHERE start_time BETWEEN $1 AND $2
        AND (
          user_id = $3
          OR $3 = ANY(user_ids)
        )
    `,
		[dayStart, dayEnd, trainerId]
	);

	for (const row of personalBookings) {
		const start = extractTimeInMinutes(row.start_time);
		const end = extractTimeInMinutes(row.end_time);
		blockedIntervals.push({ start, end });
	}

	const availableSlots: string[] = [];

	for (let h = 5; h <= 21; h++) {
		for (let m of [30]) {
			const slotStart = h * 60 + m;
			const slotEnd = slotStart + 60;

			const hasConflict = blockedIntervals.some((b) =>
				overlaps(slotStart, slotEnd, b.start, b.end)
			);

			if (!hasConflict) {
				const label = `${h.toString().padStart(2, '0')}:${m === 0 ? '00' : '30'}`;
				availableSlots.push(label);
			}
		}
	}

	return new Response(JSON.stringify({ availableSlots }));
};
