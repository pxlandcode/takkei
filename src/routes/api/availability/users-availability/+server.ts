import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function GET({ url }) {
	const userId = url.searchParams.get('userId');
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');

	if (!userId || !from || !to) {
		return json({ error: 'Missing userId, from, or to' }, { status: 400 });
	}

	try {
		const startDate = new Date(from);
		const endDate = new Date(to);
		const days: string[] = [];

		for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
			const copy = new Date(d);
			days.push(copy.toLocaleDateString('sv-SE')); // ✅ Use local date string
		}

		const weeklyAvailabilities = await query(
			`SELECT * FROM weekly_availabilities WHERE user_id = $1`,
			[userId]
		);

		const dateAvailabilities = await query(
			`SELECT * FROM date_availabilities
             WHERE user_id = $1 AND date BETWEEN $2 AND $3 AND available = true`,
			[userId, from, to]
		);

		const vacations = await query(
			`SELECT * FROM vacations
             WHERE user_id = $1 AND NOT (end_date < $2 OR start_date > $3)`,
			[userId, from, to]
		);

		const absences = await query(
			`SELECT * FROM absences
			 WHERE user_id = $1 AND (
			   (start_time <= $3 AND end_time >= $2)
			   OR (start_time <= $3 AND end_time IS NULL)
			 )`,
			[userId, from, to]
		);

		const result: Record<string, { from: string; to: string }[] | null> = {};

		for (const dateStr of days) {
			const currentDate = new Date(dateStr);
			const weekday = ((currentDate.getDay() + 6) % 7) + 1;

			// 1️⃣ Absence check (highest priority)
			const isAbsent = absences.some((a) => {
				const start = new Date(a.start_time);
				const end = a.end_time ? new Date(a.end_time) : null;

				const dayStart = new Date(currentDate);
				dayStart.setHours(0, 0, 0, 0);

				const dayEnd = new Date(currentDate);
				dayEnd.setHours(23, 59, 59, 999);

				return start <= dayEnd && (!end || end >= dayStart);
			});
			if (isAbsent) {
				result[dateStr] = null;
				continue;
			}

			// 2️⃣ Vacation check
			const isVacationDay = vacations.some((v) => {
				const start = new Date(v.start_date);
				const end = new Date(v.end_date);
				return (
					currentDate.getTime() >= start.setHours(0, 0, 0, 0) &&
					currentDate.getTime() <= end.setHours(23, 59, 59, 999)
				);
			});
			if (isVacationDay) {
				result[dateStr] = null;
				continue;
			}

			// 3️⃣ Date-based override (fix timezone comparison)
			const dateSlots = dateAvailabilities
				.filter((a) => {
					const dbDate = new Date(a.date).toLocaleDateString('sv-SE');
					return dbDate === dateStr;
				})
				.map((a) => ({ from: a.start_time, to: a.end_time }));

			if (dateSlots.length > 0) {
				result[dateStr] = dateSlots;
				continue;
			}

			// 4️⃣ Weekly fallback
			const weekSlots = weeklyAvailabilities
				.filter((a) => a.weekday === weekday)
				.map((a) => ({ from: a.start_time, to: a.end_time }));

			result[dateStr] = weekSlots.length > 0 ? weekSlots : null;
		}

		return json({ success: true, availability: result });
	} catch (err) {
		console.error('❌ Failed to fetch availability:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
