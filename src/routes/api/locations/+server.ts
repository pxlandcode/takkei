import { query } from '$lib/db';

export async function GET() {
	const queryStr = `
        SELECT id, name
        FROM locations
        ORDER BY name ASC
    `;

	try {
		console.log('Executing Query:', queryStr);
		const result = await query(queryStr);
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (error) {
		console.error('Error fetching locations:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
