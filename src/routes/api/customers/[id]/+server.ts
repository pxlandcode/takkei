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
			SELECT *
			FROM packages
			WHERE customer_id = $1
		`;
		const packages = await query(packagesSql, [id]);

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
