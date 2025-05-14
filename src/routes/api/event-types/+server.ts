import { query } from '$lib/db';
import { json } from '@sveltejs/kit';

export async function GET() {
	const result = await query('SELECT id, type FROM event_types ORDER BY type ASC');
	return json(result);
}
