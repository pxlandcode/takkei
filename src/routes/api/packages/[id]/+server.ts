import { query } from '$lib/db';

export async function GET({ params }) {
	const id = Number(params.id);
	if (isNaN(id)) return new Response('Invalid ID', { status: 400 });

	const sql = `
		SELECT 
			p.id,
			p.paid_price,
			p.first_payment_date,
			p.autogiro,
			p.invoice_numbers,
			p.payment_installments_per_date,
			p.frozen_from_date,
			a.id AS article_id,
			a.name AS article_name,
			a.sessions,
			cu.id AS customer_id,
			cu.name AS customer_name,
			cl.id AS client_id,
			cl.firstname AS client_firstname,
			cl.lastname AS client_lastname
		FROM packages p
		JOIN articles a ON p.article_id = a.id
		JOIN customers cu ON p.customer_id = cu.id
		LEFT JOIN clients cl ON p.client_id = cl.id
		WHERE p.id = $1
	`;
	const result = await query(sql, [id]);
	if (!result.length) return new Response('Not found', { status: 404 });

	const row = result[0];

	// Parse YAML-style data
	const installments = (row.payment_installments_per_date || '').split('\n').reduce(
		(acc, line) => {
			if (line.trim().startsWith("'")) {
				const date = line.trim().slice(1, 11); // 'YYYY-MM-DD'
				const sumLine = acc.next || '';
				const sumMatch = sumLine.match(/:sum:\s+([0-9.]+)/);
				const sum = sumMatch ? parseFloat(sumMatch[1]) : 0;
				acc.data.push({ date, sum });
				acc.next = null;
			} else {
				acc.next = line;
			}
			return acc;
		},
		{ data: [], next: null }
	).data;

	return new Response(
		JSON.stringify({
			id: row.id,
			paid_price: row.paid_price,
			first_payment_date: row.first_payment_date,
			autogiro: row.autogiro,
			invoice_numbers: row.invoice_numbers,
			frozen: !!row.frozen_from_date,
			client: row.client_id
				? {
						id: row.client_id,
						firstname: row.client_firstname,
						lastname: row.client_lastname
					}
				: null,
			customer: {
				id: row.customer_id,
				name: row.customer_name
			},
			article: {
				id: row.article_id,
				name: row.article_name,
				sessions: row.sessions
			},
			installments
		}),
		{ status: 200 }
	);
}
