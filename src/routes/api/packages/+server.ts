import { query } from '$lib/db';

export async function GET({ url }) {
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const offset = parseInt(url.searchParams.get('offset') || '0');
	const sortBy = url.searchParams.get('sortBy') || 'product';
	const sortOrder = url.searchParams.get('sortOrder')?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
	const search = url.searchParams.get('search')?.trim() || '';

	const validSortFields = ['product', 'customer', 'client']; // Whitelist
	const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'product';

	const params = [];
	let paramIndex = 1;

	let sql = `
                SELECT 
            p.id,
            a.name AS product,
            cu.id AS customer_id,
            cu.name AS customer_name,
            cl.id AS client_id,
            cl.firstname,
            cl.lastname,
            (
                SELECT COUNT(*) FROM bookings b
                WHERE b.package_id = p.id
            ) AS bookings,
            p.payment_installments_per_date,
            p.frozen_from_date
        FROM packages p
        JOIN articles a ON p.article_id = a.id
        JOIN customers cu ON p.customer_id = cu.id
        LEFT JOIN clients cl ON p.client_id = cl.id
	`;

	// Search on customer, product or client
	if (search) {
		sql += `
			AND (
				a.name ILIKE $${paramIndex++} OR
				cu.name ILIKE $${paramIndex++} OR
				(cl.firstname || ' ' || cl.lastname) ILIKE $${paramIndex++}
			)
		`;
		params.push(`%${search}%`, `%${search}%`, `%${search}%`);
	}

	sql += `
		ORDER BY ${safeSortBy} ${sortOrder}
		LIMIT $${paramIndex++} OFFSET $${paramIndex++}
	`;

	params.push(limit, offset);

	try {
		const raw = await query(sql, params);

		const result = raw.map((row) => {
			const yaml = row.payment_installments_per_date || '';
			const payments = yaml.split('\n').filter((line) => line.trim().startsWith("'")).length;

			return {
				id: row.id,
				product: row.product,
				bookings: row.bookings,
				payments,
				frozen: row.frozen_from_date ? 'Ja' : 'Nej',
				client: row.client_id
					? {
							id: row.client_id,
							firstname: row.firstname,
							lastname: row.lastname,
							name: `${row.firstname} ${row.lastname}`
						}
					: null,
				customer: {
					id: row.customer_id,
					name: row.customer_name
				}
			};
		});

		return new Response(JSON.stringify(result), { status: 200 });
	} catch (err) {
		console.error('Error fetching packages:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const {
			customerId,
			articleId,
			clientId,
			price,
			invoiceNumber = null,
			firstPaymentDate,
			autogiro,
			installments,
			invoiceNumbers = [], // optional array of strings or numbers
			installmentBreakdown
		} = await request.json();

		// Format YAML block with optional invoice_no per date
		let yamlData = '';
		for (const i of installmentBreakdown) {
			yamlData += `'${i.date}':\n  :date: '${i.date}'\n  :sum: ${i.sum}\n  :invoice_no: '${i.invoice_no || ''}'\n`;
		}

		const invoiceNumbersStr = invoiceNumbers.length > 0 ? `{${invoiceNumbers.join(',')}}` : '{}';

		const paymentInstallmentsStr = `{${installments}}`;

		const sql = `
			INSERT INTO packages (
				customer_id,
				article_id,
				client_id,
				paid_price,
				invoice_no,
				first_payment_date,
				autogiro,
				payment_installments_per_date,
				invoice_numbers,
				payment_installments,
				created_at,
				updated_at
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
			RETURNING id
		`;

		const params = [
			customerId,
			articleId,
			clientId || null,
			price,
			invoiceNumber,
			firstPaymentDate,
			autogiro,
			yamlData,
			invoiceNumbersStr,
			paymentInstallmentsStr
		];

		const result = await query(sql, params);
		return new Response(JSON.stringify({ id: result[0].id }), { status: 201 });
	} catch (err) {
		console.error('Error creating package:', err);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
