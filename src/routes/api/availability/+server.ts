import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function GET({ url }) {
	const userId = url.searchParams.get('userId');
	if (!userId) return json({ error: 'Missing userId' }, { status: 400 });

	const userIdNum = Number(userId);

	try {
		const weekly = await query(
			`SELECT id, user_id, weekday, start_time, end_time
			 FROM weekly_availabilities
			 WHERE user_id = $1`,
			[userIdNum]
		);

		const dates = await query(
			`SELECT id, user_id, date, start_time, end_time
			 FROM date_availabilities
			 WHERE user_id = $1`,
			[userIdNum]
		);

		const vacations = await query(
			`SELECT id, user_id, start_date, end_date
			 FROM vacations
			 WHERE user_id = $1`,
			[userIdNum]
		);

		const absences = await query(
			`SELECT id, user_id, added_by_id, approved_by_id, start_time, end_time, status, description
			 FROM absences
			 WHERE user_id = $1
			 ORDER BY start_time DESC`,
			[userIdNum]
		);

		return json({ weekly, dates, vacations, absences });
	} catch (err) {
		console.error('❌ Failed to fetch availability data:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
