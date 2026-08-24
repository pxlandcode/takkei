import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { isAdministrator, json, resolveUserWithRoles } from '../helpers';
import {
	mapEmailFooterMessageRow,
	validateEmailFooterMessagePayload,
	type EmailFooterMessageRow
} from '$lib/server/emailFooterMessages';

export const GET: RequestHandler = async ({ locals }) => {
	const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!isAdministrator(roleAwareUser)) {
		return new Response('Forbidden', { status: 403 });
	}

	try {
		const rows = await query<EmailFooterMessageRow>(
			`SELECT id, message, active, created_at, updated_at
			 FROM email_footer_messages
			 ORDER BY created_at DESC, id DESC`
		);

		return json({ data: rows.map((row) => mapEmailFooterMessageRow(row)) });
	} catch (error) {
		console.error('Failed to fetch email footer messages', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!isAdministrator(roleAwareUser)) {
		return new Response('Forbidden', { status: 403 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch (error) {
		console.error('Invalid JSON payload for email footer message create', error);
		return json({ errors: { _form: 'Ogiltig begäran' } }, 400);
	}

	const { errors, values } = validateEmailFooterMessagePayload(body);
	if (errors.message) {
		return json({ errors }, 400);
	}

	try {
		const rows = await query<EmailFooterMessageRow>(
			`INSERT INTO email_footer_messages (message, active)
			 VALUES ($1, $2)
			 RETURNING id, message, active, created_at, updated_at`,
			[values.message, values.active]
		);

		return json({ data: mapEmailFooterMessageRow(rows[0]) }, 201);
	} catch (error) {
		console.error('Failed to create email footer message', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
