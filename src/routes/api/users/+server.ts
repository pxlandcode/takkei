import { query } from '$lib/db';
import { respondJsonWithEtag } from '$lib/server/http-cache';

export async function GET({ request }) {
	const queryStr = `
        SELECT 
            users.*, 
            COALESCE(json_agg(DISTINCT roles) FILTER (WHERE roles.id IS NOT NULL), '[]') AS roles,
            locations.name AS default_location
        FROM users
        LEFT JOIN roles ON users.id = roles.user_id
        LEFT JOIN locations ON users.default_location_id = locations.id
        GROUP BY users.id, locations.name
        ORDER BY users.firstname
    `;

	try {
		const result = await query(queryStr);
		return respondJsonWithEtag(request, result);
	} catch (error) {
		console.error('Error fetching users:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
