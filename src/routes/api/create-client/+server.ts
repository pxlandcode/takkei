import { query } from '$lib/db';
import crypto from 'crypto';

export async function POST({ request }) {
	const {
		firstname,
		lastname,
		email,
		phone,
		person_number,
		primary_trainer_id,
		customer_id,
		active
	} = await request.json();

	// Check for existing email
	const existing = await query(`SELECT id FROM clients WHERE email = $1`, [email]);
	if (existing.length > 0) {
		return new Response(JSON.stringify({ errors: { email: 'E-post används redan' } }), {
			status: 400
		});
	}

	const key = crypto.randomBytes(32).toString('hex');

	const result = await query(
		`INSERT INTO clients (
			firstname, lastname, email, phone, person_number, primary_trainer_id,
			active, key, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) RETURNING id`,
		[firstname, lastname, email, phone, person_number, primary_trainer_id, active, key]
	);
	const clientId = result[0]?.id;

	if (customer_id && clientId) {
		await query(
			`INSERT INTO client_customer_relationships (
				customer_id, client_id, relationship, active, created_at, updated_at
			) VALUES ($1, $2, 'Training', true, NOW(), NOW())`,
			[customer_id, clientId]
		);
	}

	return new Response(JSON.stringify({ success: true, clientId }), {
		status: 201
	});
}
