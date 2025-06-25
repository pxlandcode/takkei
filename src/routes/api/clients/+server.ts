import { query } from '$lib/db';

export async function GET({ url }) {
	const customerId = url.searchParams.get('customerId');
	const short = url.searchParams.get('short') === 'true';
	const available = url.searchParams.get('available') === 'true';

	// New filtering/sorting/pagination options
	const search = url.searchParams.get('search')?.trim() || '';
	const sortBy = url.searchParams.get('sortBy') || 'firstname';
	const sortOrder = url.searchParams.get('sortOrder')?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
	const limit = parseInt(url.searchParams.get('limit') || '0');
	const offset = parseInt(url.searchParams.get('offset') || '0');
	const trainerId = url.searchParams.get('trainerId');
	const active = url.searchParams.get('active');

	const params: any[] = [];
	let paramIndex = 1;

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

	// Available clients not linked to any customer
	if (available) {
		whereClauses.push(`
			clients.id NOT IN (
				SELECT client_id FROM client_customer_relationships
			)
		`);
	} else if (customerId) {
		sql += ` INNER JOIN client_customer_relationships rel ON rel.client_id = clients.id `;
		whereClauses.push(`rel.customer_id = $${paramIndex++}`);
		params.push(customerId);
	}

	// Active/inactive filter
	if (active === 'true') {
		whereClauses.push(`clients.active = true`);
	} else if (active === 'false') {
		whereClauses.push(`clients.active = false`);
	}

	// Trainer ID filter
	if (trainerId) {
		whereClauses.push(`clients.primary_trainer_id = $${paramIndex++}`);
		params.push(parseInt(trainerId));
	}

	// Search filter
	if (search) {
		whereClauses.push(`
			(
				clients.firstname ILIKE $${paramIndex} OR
				clients.lastname ILIKE $${paramIndex + 1} OR
				clients.email ILIKE $${paramIndex + 2} OR
				clients.phone ILIKE $${paramIndex + 3}
			)
		`);
		params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
		paramIndex += 4;
	}

	// Remove clients with empty names
	whereClauses.push(`
		(TRIM(COALESCE(clients.firstname, '')) <> '' OR TRIM(COALESCE(clients.lastname, '')) <> '')
	`);

	// Apply WHERE clause
	if (whereClauses.length > 0) {
		sql += ` WHERE ${whereClauses.join(' AND ')}`;
	}

	// --- 3. ORDER + PAGINATION ---
	const validSortFields = ['firstname', 'lastname', 'email']; // Whitelist
	const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'firstname';

	sql += ` ORDER BY clients.${safeSortBy} ${sortOrder}`;
	if (limit > 0) {
		sql += ` LIMIT $${paramIndex}`;
		params.push(limit);
		paramIndex++;

		if (offset > 0) {
			sql += ` OFFSET $${paramIndex}`;
			params.push(offset);
			paramIndex++;
		}
	}

	try {
		const result = await query(sql, params);
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (error) {
		console.error('Error fetching clients:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
