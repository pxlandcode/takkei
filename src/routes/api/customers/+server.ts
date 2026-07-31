import { query } from '$lib/db';

export async function GET({ url }) {
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const offset = parseInt(url.searchParams.get('offset') || '0');
	const sortBy = url.searchParams.get('sortBy') || 'name';
	const sortOrder = url.searchParams.get('sortOrder')?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
	const search = url.searchParams.get('search')?.trim() || '';
	const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

	const short = url.searchParams.get('short') === 'true';

	if (short) {
		try {
			const result = await query(
				`SELECT customers.id, customers.name
				 FROM customers
				 LEFT JOIN gdpr_profile_lifecycle lifecycle
				   ON lifecycle.profile_type = 'customer'
				  AND lifecycle.customer_id = customers.id
				 ${includeDeleted ? '' : 'WHERE lifecycle.gdpr_deleted_at IS NULL'}
				 ORDER BY customers.name ASC`
			);
			return new Response(JSON.stringify(result), { status: 200 });
		} catch (error) {
			console.error('Error fetching short customers:', error);
			return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
		}
	}

	const validSortFields = ['name', 'email']; // whitelist
	const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'name';

	// Base SQL
	let sql = `
		SELECT 
			customers.id,
			customers.name,
			customers.email,
			customers.phone,
			customers.customer_no,
			customers.organization_number,
			customers.invoice_address,
			customers.invoice_zip,
			customers.invoice_city,
			customers.invoice_reference,
			customers.active,
			lifecycle.gdpr_deleted_at,
			lifecycle.gdpr_delete_token,
			lifecycle.merged_into_customer_id
		FROM customers
		LEFT JOIN gdpr_profile_lifecycle lifecycle
		  ON lifecycle.profile_type = 'customer'
		 AND lifecycle.customer_id = customers.id
		WHERE NOT (
			TRIM(customers.name) = '' AND
			TRIM(customers.email) = '' AND
			TRIM(customers.organization_number) = ''
		)
	`;

	if (!includeDeleted) {
		sql += ` AND lifecycle.gdpr_deleted_at IS NULL`;
	}

	const params = [];
	let paramIndex = 1;

	// Optional search filter
	if (search) {
		sql += `
			AND (
				customers.name ILIKE $${paramIndex++} OR
				customers.email ILIKE $${paramIndex++} OR
				customers.phone ILIKE $${paramIndex++} OR
				customers.organization_number ILIKE $${paramIndex++}
			)
		`;
		params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
	}

	// Add ordering and pagination
	sql += `
		ORDER BY customers.${safeSortBy} ${sortOrder}
		LIMIT $${paramIndex++} OFFSET $${paramIndex++}
	`;
	params.push(limit, offset);

	try {
		const result = await query(sql, params);
		return new Response(JSON.stringify(result), { status: 200 });
	} catch (error) {
		console.error('Error fetching customers:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}

export async function POST({ request }) {
	const {
		name,
		email,
		phone,
		customer_no,
		organization_number,
		invoice_address,
		invoice_zip,
		invoice_city,
		invoice_reference,
		active = true
	} = await request.json();

	if (!name || !email) {
		return new Response(JSON.stringify({ error: 'Name and email are required' }), { status: 400 });
	}

	const sql = `
		INSERT INTO customers (
			name,
			email,
			phone,
			customer_no,
			organization_number,
			invoice_address,
			invoice_zip,
			invoice_city,
			invoice_reference,
			active
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`;

	try {
		const result = await query(sql, [
			name,
			email,
			phone,
			customer_no,
			organization_number,
			invoice_address,
			invoice_zip,
			invoice_city,
			invoice_reference,
			active
		]);

		return new Response(JSON.stringify({ success: true, id: result[0].id }), { status: 201 });
	} catch (error) {
		console.error('Error creating customer:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
