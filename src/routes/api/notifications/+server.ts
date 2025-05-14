import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getNotificationsForUser,
	createNotification,
	markNotificationAsDone
} from '$lib/services/api/notificationService';

/**
 * GET /api/notifications?user_id=2
 * Returns all events for a user that are NOT marked as done
 */
export const GET: RequestHandler = async ({ url }) => {
	const userId = parseInt(url.searchParams.get('user_id') || '', 10);
	if (isNaN(userId)) return json({ error: 'Invalid or missing user_id' }, { status: 400 });

	const events = await getNotificationsForUser(userId);
	return json(events);
};

/**
 * POST /api/notifications
 * Body: { name, description, user_ids, start_time, end_time, event_type_id? }
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();

	try {
		const created = await createNotification(body);
		return json(created);
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};

/**
 * PUT /api/notifications
 * Body: { event_id, user_id }
 */
export const PUT: RequestHandler = async ({ request }) => {
	const body = await request.json();

	try {
		await markNotificationAsDone(body.event_id, body.user_id);
		return json({ success: true });
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
