import {
	deleteRoomBlock,
	RoomBlockHttpError,
	updateRoomBlock
} from '$lib/server/roomBlocks';
import type { RequestHandler } from '@sveltejs/kit';
import { json, resolveUserWithRoles } from '../../helpers';
import { hasRoomBlockAccess, resolveActorTrainerId } from '../helpers';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!hasRoomBlockAccess(roleAwareUser)) {
		return new Response('Forbidden', { status: 403 });
	}

	const actorTrainerId = resolveActorTrainerId(authUser);
	if (!actorTrainerId) {
		return json({ errors: { addedById: 'Kunde inte fastställa användaren' } }, 400);
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch (error) {
		console.error('Invalid room block update payload', error);
		return json({ errors: { _form: 'Ogiltig förfrågan' } }, 400);
	}

	try {
		const roomBlock = await updateRoomBlock(Number(params.id), {
			roomId: Number(body.roomId ?? body.room_id),
			locationId:
				body.locationId === null || body.locationId === undefined || body.locationId === ''
					? body.location_id === null || body.location_id === undefined || body.location_id === ''
						? null
						: Number(body.location_id)
					: Number(body.locationId),
			startDate: String(body.startDate ?? body.start_date ?? ''),
			startTime: String(body.startTime ?? body.start_time ?? ''),
			endDate: String(body.endDate ?? body.end_date ?? ''),
			endTime: String(body.endTime ?? body.end_time ?? ''),
			reason: typeof body.reason === 'string' ? body.reason : null,
			addedById: actorTrainerId
		});

		return json({ roomBlock });
	} catch (error) {
		if (error instanceof RoomBlockHttpError) {
			return json({ errors: error.errors, message: error.message }, error.status);
		}

		console.error('Failed to update room block', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!hasRoomBlockAccess(roleAwareUser)) {
		return new Response('Forbidden', { status: 403 });
	}

	try {
		const deleted = await deleteRoomBlock(Number(params.id));
		return json({ deleted });
	} catch (error) {
		if (error instanceof RoomBlockHttpError) {
			return json({ errors: error.errors, message: error.message }, error.status);
		}

		console.error('Failed to delete room block', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
