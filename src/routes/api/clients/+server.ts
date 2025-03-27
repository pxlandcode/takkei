import { query } from '$lib/db';

export async function GET() {
	const queryStr = `
        SELECT 
            clients.id, 
            clients.firstname, 
            clients.lastname, 
            clients.email, 
            clients.phone,
            clients.active,
            clients.membership_status,
            clients.primary_trainer_id,
            users.id AS trainer_id, 
            users.firstname AS trainer_firstname, 
            users.lastname AS trainer_lastname 

        FROM clients
        LEFT JOIN users ON clients.primary_trainer_id = users.id
        ORDER BY clients.firstname ASC, clients.lastname ASC
    `;

	try {
		const result = await query(queryStr);
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (error) {
		console.error('Error fetching clients:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
