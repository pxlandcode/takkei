import * as db from '$lib/db';
import {
	createRoomBlocks,
	listCurrentOrFutureRoomBlocksForLocation,
	RoomBlockHttpError
} from '$lib/server/roomBlocks';
import type { RequestHandler } from '@sveltejs/kit';
import type { PoolClient } from 'pg';
import { json, resolveUserWithRoles } from '../helpers';
import { hasRoomBlockAccess, resolveActorTrainerId } from './helpers';

type SqlClient = Pick<PoolClient, 'query'>;
const pool = (db as any).pool as { connect: () => Promise<PoolClient> };

async function txQuery(client: SqlClient, text: string, params: unknown[] = []) {
	return (await (db as any).queryWithClient(client as PoolClient, text, params)) as any[];
}

export const GET: RequestHandler = async ({ locals, url }) => {
	const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!hasRoomBlockAccess(roleAwareUser)) {
		return new Response('Forbidden', { status: 403 });
	}

	const locationId = Number(url.searchParams.get('locationId'));
	if (!Number.isInteger(locationId) || locationId <= 0) {
		return json({ errors: { locationId: 'Ogiltigt plats-ID' } }, 400);
	}

	try {
		const roomBlocks = await listCurrentOrFutureRoomBlocksForLocation(locationId);
		return json({ roomBlocks });
	} catch (error) {
		if (error instanceof RoomBlockHttpError) {
			return json({ errors: error.errors, message: error.message }, error.status);
		}

		console.error('Failed to fetch room blocks', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
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
		console.error('Invalid room block payload', error);
		return json({ errors: { _form: 'Ogiltig förfrågan' } }, 400);
	}

	const dbClient = await pool.connect();
	let transactionStarted = false;

	try {
		await dbClient.query('BEGIN');
		transactionStarted = true;

		const roomBlocks = await createRoomBlocks(
			{
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
				repeatWeekly: Boolean(body.repeatWeekly ?? body.repeat_weekly ?? false),
				repeatUntil:
					body.repeatUntil === null || body.repeatUntil === undefined
						? (body.repeat_until as string | null | undefined) ?? null
						: (body.repeatUntil as string | null),
				addedById: actorTrainerId
			},
			(text, params = []) => txQuery(dbClient, text, params)
		);

		await dbClient.query('COMMIT');
		transactionStarted = false;

		return json({ roomBlocks }, 201);
	} catch (error) {
		if (transactionStarted) {
			await dbClient.query('ROLLBACK');
		}

		if (error instanceof RoomBlockHttpError) {
			return json({ errors: error.errors, message: error.message }, error.status);
		}

		console.error('Failed to create room blocks', error);
		return new Response('Internal Server Error', { status: 500 });
	} finally {
		dbClient.release();
	}
};
