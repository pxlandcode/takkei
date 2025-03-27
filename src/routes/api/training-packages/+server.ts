import { query } from '$lib/db';

export async function GET() {
	try {
		// Fetch active training packages from the articles table
		const packages = await query(`
			SELECT id, name, price, sessions, validity_start_date, validity_end_date
			FROM articles
			WHERE active = true
			ORDER BY name ASC
		`);

		return new Response(JSON.stringify({ packages }), { status: 200 });
	} catch (err) {
		console.error('Error fetching training packages:', err);
		return new Response(JSON.stringify({ error: 'Could not fetch training packages' }), {
			status: 500
		});
	}
}
