import { query } from '$lib/db';

export async function POST({ params, request }) {
	const id = Number(params.id);
	if (Number.isNaN(id))
		return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });

	const { invoice_no } = await request.json().catch(() => ({}));
	const n = Number(invoice_no);
	if (!invoice_no || Number.isNaN(n))
		return new Response(JSON.stringify({ error: 'Ogiltigt fakturanummer' }), { status: 400 });

	// Append to integer array (assumes packages.invoice_numbers is int[])
	await query(
		`UPDATE packages
       SET invoice_numbers = CASE
         WHEN invoice_numbers IS NULL THEN ARRAY[$2::int]
         ELSE array_append(invoice_numbers, $2::int)
       END,
       updated_at = NOW()
     WHERE id = $1`,
		[id, n]
	);

	return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
