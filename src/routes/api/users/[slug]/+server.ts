import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import crypto from 'crypto';
import { Argon2id } from 'oslo/password';
import { trainerKeyId, trainerUserId } from '$lib/server/auth';

const argon = new Argon2id();
const HASH_METADATA = { algo: 'argon2id', version: 1 };

function encryptLegacyPassword(password: string, salt: string) {
	const hashInput = `--${salt}--${password}--`;
	return crypto.createHash('sha1').update(hashInput).digest('hex');
}

async function updateTrainerPassword(userId: number, email: string, password: string) {
	const salt = crypto.randomBytes(16).toString('hex');
	const legacyHash = encryptLegacyPassword(password, salt);
	await query(`UPDATE users SET salt = $1, crypted_password = $2 WHERE id = $3`, [
		salt,
		legacyHash,
		userId
	]);

	const luciaUserId = trainerUserId(userId);
	await query(
		`INSERT INTO auth_user (id, email, kind, trainer_id, client_id)
		 VALUES ($1, $2, 'trainer', $3, NULL)
		 ON CONFLICT (id)
		 DO UPDATE SET email = EXCLUDED.email, updated_at = NOW()`,
		[luciaUserId, email, userId]
	);

	const hashed = await argon.hash(password);
	const providerUserId = trainerKeyId(email);
	const keyId = `email:${providerUserId}`;
	await query(
		`INSERT INTO auth_key (id, user_id, hashed_password, provider_id, provider_user_id, metadata)
		 VALUES ($1, $2, $3, 'email', $4, $5::jsonb)
		 ON CONFLICT (provider_id, provider_user_id)
		 DO UPDATE SET hashed_password = EXCLUDED.hashed_password, user_id = EXCLUDED.user_id, metadata = EXCLUDED.metadata`,
		[keyId, luciaUserId, hashed, providerUserId, JSON.stringify(HASH_METADATA)]
	);
}

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
			roles,
			password
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

		if (typeof password === 'string' && password.trim().length > 0) {
			const trimmedPassword = password.trim();
			if (trimmedPassword.length < 8) {
				return json(
					{ success: false, errors: { password: 'Lösenordet måste vara minst 8 tecken' } },
					{ status: 400 }
				);
			}
			await updateTrainerPassword(Number(userId), email, trimmedPassword);
		}

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
