import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

// Fetch all achievements and check if the user meets the criteria
export async function GET({ url }) {
	const userId = url.searchParams.get('userId');
	const date = url.searchParams.get('date');

	if (!userId || !date) {
		return json({ error: 'Missing parameters' }, { status: 400 });
	}

	try {
		// Fetch all achievement-based targets (is_achievement = TRUE)
		const achievementQuery = `
            SELECT targets.id, targets.title, targets.description, targets.start_date, targets.end_date,
                   targets.achieved, target_kinds.rules
            FROM targets
            JOIN target_kinds ON targets.target_kind_id = target_kinds.id
            WHERE target_kinds.is_achievement = TRUE
        `;

		const achievements = await query(achievementQuery);

		// Process each achievement to determine if the user qualifies
		const processedAchievements = await Promise.all(
			achievements.map((achievement) => processAchievement(achievement, userId, date))
		);

		// Filter out achievements where the user does not qualify
		const earnedAchievements = processedAchievements.filter(
			(achievement) => achievement.achieved > 0
		);

		return json(earnedAchievements);
	} catch (error) {
		console.error('Error fetching achievements:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

// Process achievement rules
async function processAchievement(achievement: any, userId: number, date: string) {
	const rules = achievement.rules ? JSON.parse(achievement.rules) : {};
	let achieved = 0;

	if (rules.filter_by === 'daily_booking_count') {
		achieved = await getDaysWithMinBookings(userId, rules.min_bookings);
	}

	return { ...achievement, achieved };
}

// Count how many days a user had `min_bookings` per day
async function getDaysWithMinBookings(userId: number, minBookings: number) {
	const bookingQuery = `
        SELECT COUNT(*) AS streak_count
        FROM (
            SELECT DATE(start_time) AS booking_date
            FROM bookings
            WHERE trainer_id = $1
            AND status NOT IN ('Cancelled', 'Late_cancelled')
           AND start_time <= CURRENT_DATE
            GROUP BY DATE(start_time)
            HAVING COUNT(*) >= $2
        ) AS qualified_days;
    `;
	const params = [userId, minBookings];
	const result = await query(bookingQuery, params);

	return result.length ? Number(result[0].streak_count) : 0;
}
