import { query } from '$lib/db';

export async function GET() {
	try {
		const result = await query(`SELECT id, title FROM note_kinds ORDER BY title ASC`);
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (error) {
		console.error('Error fetching note kinds:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
