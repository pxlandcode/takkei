import { query } from '$lib/db';

export async function GET({ url }) {
	const customerId = url.searchParams.get('customerId');
	const short = url.searchParams.get('short') === 'true';
	const available = url.searchParams.get('available') === 'true';

	const params: any[] = [];

	// --- 1. SELECT ---
	let sql = `
		SELECT clients.id, clients.firstname, clients.lastname
	`;

	if (!short) {
		sql += `,
			clients.email,
			clients.phone,
			clients.active,
			clients.membership_status,
			clients.primary_trainer_id,
			users.id AS trainer_id,
			users.firstname AS trainer_firstname,
			users.lastname AS trainer_lastname
		`;
	}

	sql += `
		FROM clients
		LEFT JOIN users ON clients.primary_trainer_id = users.id
	`;

	// --- 2. FILTERS ---
	const whereClauses: string[] = [];

	// Only get clients that are NOT linked to ANY customer
	if (available) {
		whereClauses.push(`
		clients.id NOT IN (
			SELECT client_id FROM client_customer_relationships
		)
	`);
	} else if (customerId) {
		sql += `
		INNER JOIN client_customer_relationships rel ON rel.client_id = clients.id
	`;
		whereClauses.push(`rel.customer_id = $${params.length + 1}`);
		params.push(customerId);
	}

	// Remove bad data (blank names)
	whereClauses.push(`
	(TRIM(COALESCE(clients.firstname, '')) <> '' OR TRIM(COALESCE(clients.lastname, '')) <> '')
    `);

	// Append WHERE if needed
	if (whereClauses.length > 0) {
		sql += ` WHERE ${whereClauses.join(' AND ')}`;
	}

	sql += ` ORDER BY clients.firstname ASC, clients.lastname ASC`;

	try {
		const result = await query(sql, params);
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (error) {
		console.error('Error fetching clients:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
