import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function POST({ request }) {
	const body = await request.json();
	const { userId, start_date, end_date } = body;

	if (!userId || !start_date || !end_date) {
		return json({ error: 'Missing fields' }, { status: 400 });
	}

	await query(
		`INSERT INTO vacations (user_id, start_date, end_date)
         VALUES ($1, $2, $3)`,
		[userId, start_date, end_date]
	);

	return json({ success: true });
}

export async function DELETE({ url }) {
	const id = url.searchParams.get('id');
	if (!id) return json({ error: 'Missing id' }, { status: 400 });

	try {
		await query(`DELETE FROM vacations WHERE id = $1`, [id]);
		return json({ success: true });
	} catch (err) {
		console.error('❌ Failed to delete vacation:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
