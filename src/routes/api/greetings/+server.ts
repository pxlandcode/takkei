import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { json, resolveUserWithRoles } from '../settings/helpers';
import { mapGreetingRow, type GreetingRow } from '../settings/greetings/helpers';

export const GET: RequestHandler = async ({ locals, url }) => {
	const { authUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	const audienceParam = (() => {
		const raw = url?.searchParams?.get('audience')?.toLowerCase();
		if (raw === 'client' || raw === 'user' || raw === 'both') return raw;
		return 'user';
	})();

	try {
		const rows = await query<GreetingRow>(
			`SELECT id, message, icon, active, audience, created_at, updated_at
                         FROM greetings
                         WHERE active = TRUE
                           AND ($1 = 'both' OR audience = 'both' OR audience = $1)
                         ORDER BY created_at DESC, id DESC`,
			[audienceParam]
		);

		return json({ data: rows.map(mapGreetingRow) });
	} catch (error) {
		console.error('Failed to fetch greetings', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
