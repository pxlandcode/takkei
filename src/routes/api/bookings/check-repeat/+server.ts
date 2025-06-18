import { query } from '$lib/db';
import type { RequestHandler } from '@sveltejs/kit';

function extractTimeInMinutesFromDate(dateObj: Date): number {
	return dateObj.getHours() * 60 + dateObj.getMinutes();
}

function extractTimeInMinutes(timeStr: string): number {
	return parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]);
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
	return startA < endB && startB < endA;
}

export const POST: RequestHandler = async ({ request }) => {
	const { date, trainerId, locationId, roomId, time, repeatWeeks } = await request.json();

	if (!date || !trainerId || !locationId || !roomId || !time || !repeatWeeks) {
		return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
	}

	const baseDate = new Date(date);
	const slotStart = extractTimeInMinutes(time);
	const slotEnd = slotStart + 60;

	const repeatedBookings = [];

	for (let i = 0; i < repeatWeeks; i++) {
		const checkDate = new Date(baseDate);
		checkDate.setDate(baseDate.getDate() + i * 7);
		const dateString = checkDate.toISOString().split('T')[0];

		const dayStart = `${dateString} 00:00:00`;
		const dayEnd = `${dateString} 23:59:59`;

		const bookings = await query(
			`
            SELECT start_time FROM bookings
            WHERE start_time BETWEEN $1 AND $2
                AND status != 'Cancelled'
                AND (trainer_id = $3 OR room_id = $4)
            `,
			[dayStart, dayEnd, trainerId, roomId]
		);

		const personalBookings = await query(
			`
            SELECT start_time, end_time FROM personal_bookings
            WHERE start_time BETWEEN $1 AND $2
                AND (user_id = $3 OR $3 = ANY(user_ids))
            `,
			[dayStart, dayEnd, trainerId]
		);

		const blockedIntervals = [
			...bookings.map((b) => {
				const startDate = new Date(b.start_time);
				const start = extractTimeInMinutesFromDate(startDate);
				return { start, end: start + 60 };
			}),
			...personalBookings.map((b) => {
				const startDate = new Date(b.start_time);
				const endDate = new Date(b.end_time);
				const start = extractTimeInMinutesFromDate(startDate);
				const end = extractTimeInMinutesFromDate(endDate);
				return { start, end };
			})
		];

		const hasConflict = blockedIntervals.some((b) => overlaps(slotStart, slotEnd, b.start, b.end));

		let suggestedTimes = [];
		if (hasConflict) {
			for (let h = 5; h <= 21; h++) {
				for (let m of [0, 30]) {
					const altStart = h * 60 + m;
					const altEnd = altStart + 60;

					const altConflict = blockedIntervals.some((b) =>
						overlaps(altStart, altEnd, b.start, b.end)
					);

					if (!altConflict) {
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
