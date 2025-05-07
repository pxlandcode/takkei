import { query } from '$lib/db';
import crypto from 'crypto';

function encryptPassword(password, salt) {
	const hashInput = `--${salt}--${password}--`;
	return crypto.createHash('sha1').update(hashInput).digest('hex');
}

export async function POST({ request }) {
	const { firstname, lastname, email, mobile, password, default_location_id, roles } =
		await request.json();

	// 1. Check if email already exists
	const existing = await query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);

	if (existing.length > 0) {
		return new Response(
			JSON.stringify({
				success: false,
				errors: { email: 'E-postadressen används redan' }
			}),
			{ status: 400 }
		);
	}

	// 2. Create user
	const salt = crypto.randomBytes(16).toString('hex');
	const crypted_password = encryptPassword(password, salt);

	const result = await query(
		`INSERT INTO users (firstname, lastname, email, mobile, default_location_id, salt, crypted_password, active, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,true,NOW(),NOW()) RETURNING id`,
		[firstname, lastname, email, mobile, default_location_id, salt, crypted_password]
	);

	const userId = result[0]?.id;

	// 3. Add roles
	if (userId && roles?.length > 0) {
		for (const role of roles) {
			await query(
				`INSERT INTO roles (user_id, name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())`,
				[userId, role]
			);
		}
	}

	return new Response(JSON.stringify({ success: true, userId }), {
		status: 201
	});
}
