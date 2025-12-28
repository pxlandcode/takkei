import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import type { RequestHandler } from './$types';
import {
	getNotificationsForUser,
	createNotification,
	markNotificationAsDone,
	unmarkNotificationAsDone
} from '$lib/services/api/notificationService';

function parseTimestamp(value: any): number | undefined {
	if (!value) return undefined;
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
	if (typeof value === 'string') {
		const normalized = value.replace(' ', 'T');
		const withZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
		const ms = Date.parse(withZone);
		if (!Number.isNaN(ms)) return ms;
	}
	const ms = Date.parse(String(value));
	return Number.isNaN(ms) ? undefined : ms;
}

/**
 * GET /api/notifications?user_id=2&type=1
 * user_id: The ID of the user to get notifications for
 * type: The type of notification to get (optional)
 * Returns all events for a user that are NOT marked as done
 */
export const GET: RequestHandler = async ({ url, request }) => {
	const userId = parseInt(url.searchParams.get('user_id') || '', 10);
	const typeParam = url.searchParams.get('type');
	const type = typeParam ? parseInt(typeParam, 10) : undefined;

	if (isNaN(userId)) {
		return json({ error: 'Invalid or missing user_id' }, { status: 400 });
	}

	if (typeParam && isNaN(type)) {
		return json({ error: 'Invalid type parameter' }, { status: 400 });
	}

	const events = await getNotificationsForUser(userId, type);

	let maxUpdatedMs = events
		.map((row: any) => row?.updated_at || row?.updatedAt || row?.created_at || row?.createdAt)
		.map((ts: any) => parseTimestamp(ts))
		.filter((n: number | undefined): n is number => Number.isFinite(n))
		.sort((a: number, b: number) => b - a)[0];

	if (!Number.isFinite(maxUpdatedMs)) {
		const [row] = await query<{ last_updated: string | null }>(
			`SELECT MAX(updated_at) AS last_updated FROM events`
		);
		maxUpdatedMs = parseTimestamp(row?.last_updated) ?? 0;
	}

	const headers: Record<string, string> = { 'content-type': 'application/json' };
	const roundedMs = Number.isFinite(maxUpdatedMs) ? Math.floor(maxUpdatedMs / 1000) * 1000 : 0;
	headers['last-modified'] = new Date(roundedMs).toUTCString();

	const ifModifiedSince = request.headers.get('if-modified-since');
	if (ifModifiedSince) {
		const since = Date.parse(ifModifiedSince);
		if (Number.isFinite(since) && since >= roundedMs) {
			return new Response(null, { status: 304, headers });
		}
	}

	return new Response(JSON.stringify(events), { status: 200, headers });
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

export const PATCH: RequestHandler = async ({ request }) => {
	const body = await request.json();

	try {
		await unmarkNotificationAsDone(body.event_id, body.user_id);
		return json({ success: true });
	} catch (err: any) {
		return json({ error: err.message }, { status: 500 });
	}
};
