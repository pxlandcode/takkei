import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function POST({ request }) {
	const body = await request.json();
	const { userId, date, start_time, end_time } = body;

	if (!userId || !date || !start_time || !end_time) {
		return json({ error: 'Missing fields' }, { status: 400 });
	}

	await query(
		`INSERT INTO date_availabilities (user_id, date, start_time, end_time)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (user_id, date)
		 DO UPDATE SET start_time = $3, end_time = $4`,
		[userId, date, start_time, end_time]
	);

	return json({ success: true });
}

export async function DELETE({ url }) {
	const id = url.searchParams.get('id');

	if (!id) {
		return json({ error: 'Missing id' }, { status: 400 });
	}

	try {
		await query(`DELETE FROM date_availabilities WHERE id = $1`, [id]);
		return json({ success: true });
	} catch (err) {
		console.error('❌ Failed to delete date availability:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
