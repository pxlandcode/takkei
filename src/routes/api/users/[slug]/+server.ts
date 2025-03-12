import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

/**
 * Fetch a user by ID with roles and default location
 */
export async function GET({ params }) {
	const userId = params.slug;

	// SQL query to fetch the full user details with roles and location
	const queryStr = `
        SELECT 
            users.*, 
            COALESCE(json_agg(DISTINCT roles) FILTER (WHERE roles.id IS NOT NULL), '[]') AS roles,
            locations.name AS default_location
        FROM users
        LEFT JOIN roles ON users.id = roles.user_id
        LEFT JOIN locations ON users.default_location_id = locations.id
        WHERE users.id = $1
        GROUP BY users.id, locations.name
    `;

	try {
		const result = await query(queryStr, [userId]);

		if (result.length === 0) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		return json(result[0]);
	} catch (error) {
		console.error('Error fetching user:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
