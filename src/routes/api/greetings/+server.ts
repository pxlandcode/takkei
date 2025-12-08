import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { json, resolveUserWithRoles } from '../settings/helpers';
import { mapGreetingRow, type GreetingRow } from '../settings/greetings/helpers';

export const GET: RequestHandler = async ({ locals }) => {
	const { authUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	try {
		const rows = await query<GreetingRow>(
			`SELECT id, message, icon, active, created_at, updated_at
                         FROM greetings
                         WHERE active = TRUE
                         ORDER BY created_at DESC, id DESC`
		);

		return json({ data: rows.map(mapGreetingRow) });
	} catch (error) {
		console.error('Failed to fetch greetings', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
