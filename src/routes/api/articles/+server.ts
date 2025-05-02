// src/routes/api/articles/+server.ts
import { query } from '$lib/db';

export async function GET() {
	try {
		const result = await query(`
			SELECT id, name, price, sessions, validity_start_date, validity_end_date, kind
			FROM articles
			WHERE active = true
			ORDER BY sessions ASC
		`);

		return new Response(JSON.stringify(result), { status: 200 });
	} catch (err) {
		console.error('Error fetching articles:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
