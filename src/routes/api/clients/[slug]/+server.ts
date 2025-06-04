import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

/**
 * Fetch a client by ID with primary trainer details
 */
export async function GET({ params }) {
	const clientId = params.slug;

	const queryStr = `
        SELECT 
            clients.*, 
            users.id AS trainer_id, 
            users.firstname AS trainer_firstname, 
            users.lastname AS trainer_lastname
        FROM clients
        LEFT JOIN users ON clients.primary_trainer_id = users.id
        WHERE clients.id = $1
    `;

	try {
		const result = await query(queryStr, [clientId]);

		if (result.length === 0) {
			return json({ error: 'Client not found' }, { status: 404 });
		}

		return json(result[0]);
	} catch (error) {
		console.error('Error fetching client:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

export async function PUT({ request, params }) {
	const clientId = params.slug;
	const body = await request.json();

	try {
		const updateQuery = `
			UPDATE clients SET
				firstname = $1,
				lastname = $2,
				person_number = $3,
				email = $4,
				alternative_email = $5,
				phone = $6,
				primary_trainer_id = $7,
				active = $8,
				updated_at = NOW()
			WHERE id = $9
			RETURNING *
		`;

		const values = [
			body.firstname,
			body.lastname,
			body.person_number,
			body.email,
			body.alternative_email,
			body.phone,
			body.primary_trainer_id,
			body.active,
			clientId
		];

		const result = await query(updateQuery, values);

		if (result.length === 0) {
			return json({ error: 'Client not found or not updated' }, { status: 404 });
		}

		return json(result[0]);
	} catch (error) {
		console.error('Error updating client:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
