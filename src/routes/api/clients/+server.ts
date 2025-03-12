import { query } from '$lib/db';

export async function GET() {
	const queryStr = `
        SELECT id, firstname, lastname, email
        FROM clients
        ORDER BY firstname ASC, lastname ASC
    `;

	try {
		const result = await query(queryStr);
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (error) {
		console.error('Error fetching clients:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
