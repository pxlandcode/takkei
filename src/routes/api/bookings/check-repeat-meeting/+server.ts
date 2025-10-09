import { query } from '$lib/db';
import { extractStockholmMinutes } from '$lib/server/stockholm-time';
import type { RequestHandler } from '@sveltejs/kit';

function extractTimeInMinutes(timeStr: string): number {
	const [h, m] = timeStr.split(':').map(Number);
	return h * 60 + m;
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
	return startA < endB && startB < endA;
}

export const POST: RequestHandler = async ({ request }) => {
	const raw = await request.json();

	const user_ids = Array.isArray(raw.user_ids)
		? raw.user_ids
				.map((id: string | number) => parseInt(id as string, 10))
				.filter((id) => !isNaN(id))
		: [];

	const { date, time, repeatWeeks, endTime } = raw;

	if (!date || !time || !user_ids.length || !repeatWeeks || !endTime) {
		console.error('❌ Missing or invalid parameters:', {
			date,
			time,
			user_ids,
			repeatWeeks,
			endTime
		});
		return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
	}

	const baseDate = new Date(date);
	const slotStart = extractTimeInMinutes(time);
	const slotEnd = extractTimeInMinutes(endTime);

	const repeatedBookings = [];

	for (let i = 0; i < repeatWeeks; i++) {
		const checkDate = new Date(baseDate);
		checkDate.setDate(baseDate.getDate() + i * 7);
		const dateString = checkDate.toISOString().split('T')[0];

		const dayStart = `${dateString} 00:00:00`;
		const dayEnd = `${dateString} 23:59:59`;

		const placeholders = user_ids.map((_, idx) => `$${idx + 3}`).join(',');
		const values = [dayStart, dayEnd, ...user_ids];

		const personalBookings = await query(
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
		);

		const conflictingUserIds = new Set<number>();

		for (const b of personalBookings) {
			const start = extractStockholmMinutes(b.start_time);
			const end = extractStockholmMinutes(b.end_time);
			if (start === null || end === null) continue;

			if (overlaps(slotStart, slotEnd, start, end)) {
				if (b.user_id && user_ids.includes(b.user_id)) {
					conflictingUserIds.add(b.user_id);
				}
				if (Array.isArray(b.user_ids)) {
					b.user_ids.forEach((uid: number) => {
						if (user_ids.includes(uid)) {
							conflictingUserIds.add(uid);
						}
					});
				}
			}
		}

		const hasConflict = conflictingUserIds.size > 0;

		let suggestedTimes: string[] = [];
		if (hasConflict) {
			for (let h = 5; h <= 21; h++) {
				for (let m of [0, 30]) {
					const altStart = h * 60 + m;
					const altEnd = altStart + (slotEnd - slotStart);

					const conflict = personalBookings.some((b) => {
						const s = extractStockholmMinutes(b.start_time);
						const e = extractStockholmMinutes(b.end_time);
						if (s === null || e === null) return false;
						return overlaps(altStart, altEnd, s, e);
					});

					if (!conflict) {
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
			conflictingUserIds: Array.from(conflictingUserIds),
			suggestedTimes
		});
	}

	return new Response(JSON.stringify({ success: true, repeatedBookings }));
};
