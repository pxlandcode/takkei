import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { isAdministrator, json, resolveUserWithRoles } from '../helpers';
import { mapGreetingRow, validateGreetingPayload, type GreetingRow } from './helpers';

export const GET: RequestHandler = async ({ locals }) => {
	const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!isAdministrator(roleAwareUser)) {
		return new Response('Forbidden', { status: 403 });
	}

	try {
		const rows = await query<GreetingRow>(
			`SELECT id, message, icon, active, audience, created_at, updated_at
                         FROM greetings
                         ORDER BY created_at DESC, id DESC`
		);

		return json({ data: rows.map((row) => mapGreetingRow(row)) });
	} catch (error) {
		console.error('Failed to fetch greetings', error);
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
		console.error('Invalid JSON payload for greeting create', error);
		return json({ errors: { _form: 'Ogiltig begäran' } }, 400);
	}

	const { errors, values } = validateGreetingPayload(body);
	if (errors.message) {
		return json({ errors }, 400);
	}

	try {
		const rows = await query<GreetingRow>(
			`INSERT INTO greetings (message, icon, active, audience)
                         VALUES ($1, $2, $3, $4)
                         RETURNING id, message, icon, active, audience, created_at, updated_at`,
			[values.message, values.icon, values.active, values.audience]
		);

		const created = rows[0];
		return json({ data: mapGreetingRow(created) }, 201);
	} catch (error) {
		console.error('Failed to create greeting', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
