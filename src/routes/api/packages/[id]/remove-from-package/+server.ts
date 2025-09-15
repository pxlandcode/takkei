import { query } from '$lib/db';

export async function POST({ params }) {
	const id = Number(params.id);
	if (Number.isNaN(id))
		return new Response(JSON.stringify({ error: 'Invalid ID' }), { status: 400 });

	await query(`UPDATE bookings SET package_id = NULL, updated_at = NOW() WHERE id = $1`, [id]);
	return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
