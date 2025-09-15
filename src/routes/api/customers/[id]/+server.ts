// /api/customers/[id]/+server.ts (list view payload)
import { query } from '$lib/db';

export async function GET({ params }) {
	const id = params.id;

	// customer
	const [customer] = await query(
		`SELECT id, name, email, phone, customer_no, organization_number,
            invoice_address, invoice_zip, invoice_city, invoice_reference, active
     FROM customers WHERE id = $1`,
		[id]
	);
	if (!customer)
		return new Response(JSON.stringify({ error: 'Customer not found' }), { status: 404 });

	// clients (optional for sidebar/things)
	const clients = await query(
		`SELECT cl.id, cl.firstname, cl.lastname
     FROM client_customer_relationships r
     JOIN clients cl ON cl.id = r.client_id
     WHERE r.customer_id = $1 AND r.active = TRUE`,
		[id]
	);

	// packages summary
	const rawPackages = await query(
		`SELECT
       p.id, p.customer_id, p.client_id, p.autogiro, p.frozen_from_date,
       p.invoice_numbers, p.article_id,
       a.name  AS article_name,
       a.sessions AS article_sessions,
       cl.firstname AS client_firstname, cl.lastname AS client_lastname
     FROM packages p
     LEFT JOIN articles a ON a.id = p.article_id
     LEFT JOIN clients  cl ON cl.id = p.client_id
     WHERE p.customer_id = $1
     ORDER BY p.id ASC`,
		[id]
	);

	// chargeable bookings used up to now per package
	const ids = rawPackages.map((p: any) => p.id);
	let bookingCounts: Record<number, number> = {};
	if (ids.length) {
		const rows = await query(
			`SELECT package_id, COUNT(*)::int AS cnt
   FROM bookings
   WHERE package_id = ANY($1::int[])
     AND (status IS NULL OR status NOT IN ('Cancelled','Canceled'))
   GROUP BY package_id`,
			[ids]
		);
		bookingCounts = rows.reduce((acc: any, r: any) => ((acc[r.package_id] = r.cnt), acc), {});
	}

	const packages = rawPackages.map((p: any) => {
		const sessions = Number(p.article_sessions) || 0;
		const used = bookingCounts[p.id] ?? 0;
		const remaining = Math.max(0, sessions - used);

		return {
			id: p.id,
			article: { id: p.article_id, name: p.article_name },
			client: p.client_id
				? {
						id: p.client_id,
						firstname: p.client_firstname,
						lastname: p.client_lastname
					}
				: null,
			autogiro: !!p.autogiro,
			frozen_from_date: p.frozen_from_date,
			invoice_numbers: p.invoice_numbers || [],
			remaining_sessions: remaining // <-- Saldo in the old UI
		};
	});

	return new Response(JSON.stringify({ ...customer, clients, packages }), { status: 200 });
}
