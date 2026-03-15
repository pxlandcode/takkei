import { query } from '$lib/db';

export async function POST({ params }) {
	const id = Number(params.id);
	if (Number.isNaN(id))
		return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });

	await query(
		`UPDATE bookings
		 SET package_id = NULL,
		     added_to_package_date = NULL,
		     added_to_package_by = NULL,
		     updated_at = NOW()
		 WHERE id = $1`,
		[id]
	);
	return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
