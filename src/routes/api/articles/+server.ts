// src/routes/api/articles/+server.ts
import { query } from '$lib/db';
import { createHash } from 'crypto';

export async function GET({ request }: { request: Request }) {
	try {
		const result = await query(`
			SELECT id, name, price, sessions, validity_start_date, validity_end_date, kind
			FROM articles
			WHERE active = true
			ORDER BY sessions ASC
		`);

		const body = JSON.stringify(result);
		const etag = `"${createHash('sha1').update(body).digest('hex')}"`;
		const ifNoneMatch = request.headers.get('if-none-match');

		if (ifNoneMatch === etag) {
			return new Response(null, { status: 304, headers: { ETag: etag } });
		}

		return new Response(body, { status: 200, headers: { ETag: etag } });
	} catch (err) {
		console.error('Error fetching articles:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
