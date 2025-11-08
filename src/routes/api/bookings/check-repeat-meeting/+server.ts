import type { RequestHandler } from '@sveltejs/kit';
import { fetchBusyBlocksForUsers } from '$lib/server/meetingBusyHelper';

function extractTimeInMinutes(timeStr: string): number {
	const [h, m] = timeStr.split(':').map(Number);
	return h * 60 + m;
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
	return startA < endB && startB < endA;
}

function minutesToTime(value: number): string {
	const normalized = ((value % (24 * 60)) + 24 * 60) % (24 * 60);
	const hours = Math.floor(normalized / 60)
		.toString()
		.padStart(2, '0');
	const minutes = (normalized % 60).toString().padStart(2, '0');
	return `${hours}:${minutes}`;
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

	if (!Number.isFinite(slotStart) || !Number.isFinite(slotEnd) || slotEnd <= slotStart) {
		return new Response(JSON.stringify({ error: 'Invalid time range' }), { status: 400 });
	}

	const repeatedBookings = [];

	for (let i = 0; i < repeatWeeks; i++) {
		const checkDate = new Date(baseDate);
		checkDate.setDate(baseDate.getDate() + i * 7);
		const dateString = checkDate.toISOString().split('T')[0];

		const busyBlocks = await fetchBusyBlocksForUsers(dateString, user_ids);

		const conflictingUserIds = new Set<number>();

		for (const block of busyBlocks) {
			if (!overlaps(slotStart, slotEnd, block.start, block.end)) continue;
			for (const uid of block.userIds) {
				conflictingUserIds.add(uid);
			}
		}

		const futureBoundaries = busyBlocks
			.filter((block) => block.start >= slotStart)
			.map((block) => block.start);
		const nextBoundary = futureBoundaries.length > 0 ? minutesToTime(Math.min(...futureBoundaries)) : null;

		const hasConflict = conflictingUserIds.size > 0;

		let suggestedTimes: string[] = [];
		if (hasConflict) {
			for (let h = 5; h <= 21; h++) {
				for (let m of [0, 30]) {
					const altStart = h * 60 + m;
					const altEnd = altStart + (slotEnd - slotStart);

					const conflict = busyBlocks.some((block) => overlaps(altStart, altEnd, block.start, block.end));

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
			suggestedTimes,
			nextBoundary
		});
	}

	return new Response(JSON.stringify({ success: true, repeatedBookings }));
};
