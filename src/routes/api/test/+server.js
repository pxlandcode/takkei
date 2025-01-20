import { json } from '@sveltejs/kit';
import { query } from '$lib/db.js';

export async function GET() {
	const data = await query('SELECT * FROM users LIMIT 10;');
	return json(data);
}
