import { query } from '$lib/db';

export async function GET({ params }) {
	const id = params.id;

	try {
		// Get customer info
		const customerSql = `
			SELECT 
				id,
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
			FROM customers
			WHERE id = $1
		`;
		const customerResult = await query(customerSql, [id]);

		if (customerResult.length === 0) {
			return new Response(JSON.stringify({ error: 'Customer not found' }), { status: 404 });
		}

		const customer = customerResult[0];

		// Get clients connected via client_customer_relationships
		const clientsSql = `
			SELECT 
				cl.id,
				cl.firstname,
				cl.lastname
			FROM client_customer_relationships r
			JOIN clients cl ON cl.id = r.client_id
			WHERE r.customer_id = $1
		`;
		const clients = await query(clientsSql, [id]);

		// Get packages
		const packagesSql = `
  SELECT 
    p.*,
    cl.id AS client_id,
    cl.firstname AS client_firstname,
    cl.lastname AS client_lastname,
    a.id AS article_id,
    a.name AS article_name,
    a.price AS article_price,
    a.kind AS article_kind
  FROM packages p
  LEFT JOIN clients cl ON cl.id = p.client_id
  LEFT JOIN articles a ON a.id = p.article_id
  WHERE p.customer_id = $1
`;

		const rawPackages = await query(packagesSql, [id]);

		const packages = rawPackages.map((p) => ({
			id: p.id,
			customer_id: p.customer_id,
			article_id: p.article_id,
			client_id: p.client_id,
			created_at: p.created_at,
			updated_at: p.updated_at,
			paid_price: p.paid_price,
			invoice_no: p.invoice_no,
			first_payment_date: p.first_payment_date,
			payment_installments: p.payment_installments,
			invoice_numbers: p.invoice_numbers,
			autogiro: p.autogiro,
			payment_installment_sums: p.payment_installment_sums,
			payment_installments_per_date: p.payment_installments_per_date,
			frozen_from_date: p.frozen_from_date,
			upgraded: p.upgraded,
			client: p.client_id
				? {
						id: p.client_id,
						firstname: p.client_firstname,
						lastname: p.client_lastname
					}
				: null,
			article: {
				id: p.article_id,
				name: p.article_name,
				price: p.article_price,
				kind: p.article_kind
			}
		}));
		// Final structure
		const responseData = {
			...customer,
			clients,
			packages
		};

		return new Response(JSON.stringify(responseData), { status: 200 });
	} catch (error) {
		console.error('Error fetching customer details:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
