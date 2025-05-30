import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteNotification } from '$lib/services/api/notificationService';

/**
 * DELETE /api/notifications/[id]
 */
export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) return json({ error: 'Invalid notification id' }, { status: 400 });

	try {
		await deleteNotification(id);
		return json({ success: true });
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
