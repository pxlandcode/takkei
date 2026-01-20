import type { RequestHandler } from '@sveltejs/kit';
import { fetchBusyBlocksForUsers } from '$lib/server/meetingBusyHelper';

function extractTimeInMinutes(timeStr: string): number {
	const [h, m] = timeStr.split(':').map(Number);
	return h * 60 + m;
}

function minutesToTime(value: number): string {
	const normalized = ((value % (24 * 60)) + 24 * 60) % (24 * 60);
	const hours = Math.floor(normalized / 60)
		.toString()
		.padStart(2, '0');
	const minutes = (normalized % 60).toString().padStart(2, '0');
	return `${hours}:${minutes}`;
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
	return startA < endB && startB < endA;
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const rawUserIds = Array.isArray(body.user_ids) ? body.user_ids : [];
	const userIds = rawUserIds
		.map((id: number | string) => Number(id))
		.filter((id) => Number.isFinite(id));

	const { date, time, endTime } = body;
	const ignoreBookingIdRaw = body?.ignoreBookingId;
	const ignoreBookingId = Number.isFinite(Number(ignoreBookingIdRaw))
		? Number(ignoreBookingIdRaw)
		: null;

	if (!date || !time || userIds.length === 0) {
		return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
	}

	const slotStart = extractTimeInMinutes(time);
	const slotEnd = endTime ? extractTimeInMinutes(endTime) : null;

	if (!Number.isFinite(slotStart)) {
		return new Response(JSON.stringify({ error: 'Invalid time' }), { status: 400 });
	}

	const busyBlocks = await fetchBusyBlocksForUsers(date, userIds, {
		ignorePersonalBookingId: ignoreBookingId ?? undefined
	});

	const conflictingUserIds = new Set<number>();
	if (slotEnd !== null && slotEnd > slotStart) {
		for (const block of busyBlocks) {
			if (overlaps(slotStart, slotEnd, block.start, block.end)) {
				block.userIds.forEach((uid) => conflictingUserIds.add(uid));
			}
		}
	}

	const futureStarts = busyBlocks
		.filter((block) => block.start >= slotStart)
		.map((block) => block.start);
	const nextBoundary =
		futureStarts.length > 0 ? minutesToTime(Math.min(...futureStarts)) : null;

	return new Response(
		JSON.stringify({
			success: true,
			nextBoundary,
			conflictingUserIds: Array.from(conflictingUserIds)
		})
	);
};
