import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

function norm(t?: string | null) {
	if (!t) return null;

	const v = t.trim();
	if (v === '') return null;

	if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
	if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return v;

	return null;
}

export async function POST({ request }) {
	const data = await request.json();
	const { userId, weeklyAvailability } = data;

	if (!userId || !Array.isArray(weeklyAvailability)) {
		console.error('❌ Missing required fields:', data);
		return json({ error: 'Missing fields' }, { status: 400 });
	}

	try {
		for (const day of weeklyAvailability) {
			if (typeof day.weekday !== 'number') continue;

			const weekday = day.weekday; // 1..6, 0
			const start = norm(day.start_time);
			const end = norm(day.end_time);

			if (!start && !end) {
				await query(`DELETE FROM weekly_availabilities WHERE user_id = $1 AND weekday = $2`, [
					userId,
					weekday
				]);
				continue;
			}

			const existing = await query(
				`SELECT id FROM weekly_availabilities WHERE user_id = $1 AND weekday = $2`,
				[userId, weekday]
			);

			if (existing.length > 0) {
				await query(
					`UPDATE weekly_availabilities
             SET start_time = $1, end_time = $2, updated_at = NOW()
           WHERE id = $3`,
					[start, end, existing[0].id]
				);
			} else {
				await query(
					`INSERT INTO weekly_availabilities (user_id, weekday, start_time, end_time)
           VALUES ($1, $2, $3, $4)`,
					[userId, weekday, start, end]
				);
			}
		}

		return json({ success: true });
	} catch (err) {
		console.error('❌ Failed to save weekly availability:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
