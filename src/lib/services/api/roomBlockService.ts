import { invalidateByPrefix, wrapFetch } from '$lib/services/api/apiCache';

const BASE = '/api/settings/room-blocks';

export type RoomBlockRecord = {
	id: number;
	roomId: number;
	roomName: string;
	roomHalfHourStart: boolean;
	startTime: string;
	endTime: string;
	reason: string | null;
	addedById: number | null;
	addedByName: string | null;
	createdAt: string | null;
	updatedAt: string | null;
};

export type RoomBlockMutationPayload = {
	roomId: number;
	locationId?: number | null;
	startDate: string;
	startTime: string;
	endDate: string;
	endTime: string;
	reason?: string | null;
	repeatWeekly?: boolean;
	repeatUntil?: string | null;
};

function invalidateRoomBlockCaches() {
	invalidateByPrefix(BASE);
}

async function parseError(res: Response, fallback: string): Promise<Error> {
	try {
		const data = await res.json();
		const errors = data?.errors && typeof data.errors === 'object' ? data.errors : null;
		const message =
			typeof data?.message === 'string'
				? data.message
				: typeof data?.error === 'string'
					? data.error
					: fallback;
		const error = new Error(message) as Error & { fieldErrors?: Record<string, string> };
		if (errors) {
			error.fieldErrors = errors;
		}
		return error;
	} catch {
		return new Error(fallback);
	}
}

export async function listRoomBlocks(locationId: number): Promise<RoomBlockRecord[]> {
	const res = await wrapFetch(fetch)(`${BASE}?locationId=${locationId}`);
	if (!res.ok) {
		throw await parseError(res, 'Kunde inte hämta blockeringar');
	}

	const data = await res.json();
	return Array.isArray(data?.roomBlocks) ? data.roomBlocks : [];
}

export async function createRoomBlocks(payload: RoomBlockMutationPayload): Promise<RoomBlockRecord[]> {
	const res = await fetch(BASE, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (!res.ok) {
		throw await parseError(res, 'Kunde inte skapa blockeringen');
	}

	invalidateRoomBlockCaches();
	const data = await res.json();
	return Array.isArray(data?.roomBlocks) ? data.roomBlocks : [];
}

export async function updateRoomBlock(
	id: number,
	payload: Omit<RoomBlockMutationPayload, 'repeatWeekly' | 'repeatUntil'>
): Promise<RoomBlockRecord | null> {
	const res = await fetch(`${BASE}/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (!res.ok) {
		throw await parseError(res, 'Kunde inte uppdatera blockeringen');
	}

	invalidateRoomBlockCaches();
	const data = await res.json();
	return data?.roomBlock ?? null;
}

export async function deleteRoomBlock(id: number) {
	const res = await fetch(`${BASE}/${id}`, {
		method: 'DELETE'
	});

	if (!res.ok) {
		throw await parseError(res, 'Kunde inte ta bort blockeringen');
	}

	invalidateRoomBlockCaches();
	return await res.json();
}
