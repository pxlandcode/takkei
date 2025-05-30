import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSentNotifications } from '$lib/services/api/notificationService';

export const GET: RequestHandler = async ({ url }) => {
	const userId = Number(url.searchParams.get('user_id'));
	const offset = Number(url.searchParams.get('offset') || '0');
	const limit = Number(url.searchParams.get('limit') || '10');

	if (!userId) return json({ error: 'Missing user_id' }, { status: 400 });

	try {
		const notifications = await getSentNotifications({ userId, offset, limit });
		return json(notifications);
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
