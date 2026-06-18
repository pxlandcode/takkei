import { listLocationCalendarRoomBlockSlots, RoomBlockHttpError } from '$lib/server/roomBlocks';
import { respondJsonWithEtag } from '$lib/server/http-cache';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, request }) => {
	const locationIds = url.searchParams
		.getAll('locationId')
		.map((value) => Number(value))
		.filter((value) => Number.isFinite(value));
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');

	if (locationIds.length === 0 || !from || !to) {
		return json({ error: 'Missing locationId, from, or to' }, { status: 400 });
	}

	try {
		const roomBlocks = await listLocationCalendarRoomBlockSlots({
			locationIds,
			from,
			to
		});

		return respondJsonWithEtag(request, {
			success: true,
			roomBlocks
		});
	} catch (error) {
		if (error instanceof RoomBlockHttpError) {
			return json({ error: error.message, errors: error.errors }, { status: error.status });
		}

		console.error('Failed to fetch calendar room blocks', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
