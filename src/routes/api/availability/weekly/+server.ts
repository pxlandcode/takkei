import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

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

			// Convert empty strings to null
			const safeStart = day.start_time === '' ? null : day.start_time;
			const safeEnd = day.end_time === '' ? null : day.end_time;

			// Skip if both are null — don't insert/update
			if (!safeStart && !safeEnd) continue;

			const existing = await query(
				`SELECT id FROM weekly_availabilities WHERE user_id = $1 AND weekday = $2`,
				[userId, day.weekday]
			);

			if (existing.length > 0) {
				await query(
					`UPDATE weekly_availabilities SET start_time = $1, end_time = $2, updated_at = NOW() WHERE id = $3`,
					[safeStart, safeEnd, existing[0].id]
				);
			} else {
				await query(
					`INSERT INTO weekly_availabilities (user_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4)`,
					[userId, day.weekday, safeStart, safeEnd]
				);
			}
		}

		return json({ success: true });
	} catch (err) {
		console.error('❌ Failed to save weekly availability:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
