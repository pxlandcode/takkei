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
