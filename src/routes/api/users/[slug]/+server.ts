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

export async function PUT({ request, params }) {
	const userId = params.slug;

	try {
		const {
			firstname,
			lastname,
			initials,
			email,
			mobile,
			default_location_id,
			active,
			comment,
			key,
			roles
		} = await request.json();

		// Validate required fields
		if (!firstname || !lastname || !email) {
			return json(
				{ success: false, errors: { general: 'Obligatoriska fält saknas' } },
				{ status: 400 }
			);
		}

		const normalizedRoles = Array.isArray(roles)
			? Array.from(
					new Set(
						roles.filter((role) => typeof role === 'string' && role.trim().length > 0).map((r) => r.trim())
					)
			  )
			: [];

		if (normalizedRoles.length === 0) {
			return json(
				{ success: false, errors: { roles: 'Minst en roll måste väljas' } },
				{ status: 400 }
			);
		}

		const sanitizedComment =
			typeof comment === 'string' && comment.trim().length > 0 ? comment.trim() : null;
		const sanitizedKey = typeof key === 'string' && key.trim().length > 0 ? key.trim() : null;

		await query(
			`
			UPDATE users SET
				firstname = $1,
				lastname = $2,
				initials = $3,
				email = $4,
				mobile = $5,
				default_location_id = $6,
				active = $7,
				comment = $8,
				"key" = $9,
				updated_at = NOW()
			WHERE id = $10
			`,
			[
				firstname,
				lastname,
				initials,
				email,
				mobile,
				default_location_id ?? null,
				active,
				sanitizedComment,
				sanitizedKey,
				userId
			]
		);

		await query(`DELETE FROM roles WHERE user_id = $1`, [userId]);

		for (const roleName of normalizedRoles) {
			await query(
				`INSERT INTO roles (user_id, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())`,
				[userId, roleName]
			);
		}

		const updatedUser = await query(
			`
        SELECT 
            users.*, 
            COALESCE(json_agg(DISTINCT roles) FILTER (WHERE roles.id IS NOT NULL), '[]') AS roles,
            locations.name AS default_location
        FROM users
        LEFT JOIN roles ON users.id = roles.user_id
        LEFT JOIN locations ON users.default_location_id = locations.id
        WHERE users.id = $1
        GROUP BY users.id, locations.name
        LIMIT 1
      `,
			[userId]
		);

		return json({ success: true, user: updatedUser[0] ?? null });
	} catch (err) {
		console.error('Update user error:', err);
		return json(
			{ success: false, errors: { general: 'Ett fel uppstod vid uppdatering' } },
			{ status: 500 }
		);
	}
}
