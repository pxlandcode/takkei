import { query } from '$lib/db';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
	try {
		// Fetch booking contents from the database
		const result = await query(
			`SELECT id, kind, created_at, updated_at FROM booking_contents ORDER BY id ASC`
		);

		// Return the booking contents as JSON
		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error fetching booking contents:', error);
		return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
	}
};
