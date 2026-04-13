import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/db';
import type {
	UserAvailabilityMap,
	UserBlockedDaysMap,
	UsersAvailabilityResponse
} from '$lib/services/api/calendarService';

type AvailabilityRow = {
	user_id: number;
	weekday?: number;
	date?: string | Date;
	start_time?: string;
	end_time?: string;
	start_date?: string | Date;
	end_date?: string | Date | null;
};

function groupRowsByUser<T extends AvailabilityRow>(rows: T[]) {
	const grouped = new Map<number, T[]>();
	for (const row of rows) {
		const userId = Number(row.user_id);
		if (!Number.isFinite(userId)) continue;
		const existing = grouped.get(userId);
		if (existing) {
			existing.push(row);
		} else {
			grouped.set(userId, [row]);
		}
	}
	return grouped;
}

export const GET: RequestHandler = async ({ url }) => {
	const userIds = Array.from(
		new Set(
			url.searchParams
				.getAll('userId')
				.map((value) => Number(value))
				.filter((value) => Number.isFinite(value))
		)
	);
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');

	if (userIds.length === 0 || !from || !to) {
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

		const weeklyAvailabilities = (await query(
			`SELECT * FROM weekly_availabilities WHERE user_id = ANY($1::int[])`,
			[userIds]
		)) as AvailabilityRow[];

		const dateAvailabilities = (await query(
			`SELECT * FROM date_availabilities
             WHERE user_id = ANY($1::int[]) AND date BETWEEN $2 AND $3 AND available = true`,
			[userIds, from, to]
		)) as AvailabilityRow[];

		const vacations = (await query(
			`SELECT * FROM vacations
             WHERE user_id = ANY($1::int[]) AND NOT (end_date < $2 OR start_date > $3)`,
			[userIds, from, to]
		)) as AvailabilityRow[];

		const absences = (await query(
			`SELECT * FROM absences
			 WHERE user_id = ANY($1::int[]) AND (
			   (start_time <= $3 AND end_time >= $2)
			   OR (start_time <= $3 AND end_time IS NULL)
			 )`,
			[userIds, from, to]
		)) as AvailabilityRow[];

		const weeklyByUser = groupRowsByUser(weeklyAvailabilities);
		const dateByUser = groupRowsByUser(dateAvailabilities);
		const vacationsByUser = groupRowsByUser(vacations);
		const absencesByUser = groupRowsByUser(absences);

		const availability: UsersAvailabilityResponse['availability'] = {};
		const blockedDays: UsersAvailabilityResponse['blockedDays'] = {};

		for (const userId of userIds) {
			const result: UserAvailabilityMap = {};
			const userBlockedDays: UserBlockedDaysMap = {};
			const userWeeklyAvailabilities = weeklyByUser.get(userId) ?? [];
			const userDateAvailabilities = dateByUser.get(userId) ?? [];
			const userVacations = vacationsByUser.get(userId) ?? [];
			const userAbsences = absencesByUser.get(userId) ?? [];

			for (const dateStr of days) {
				const currentDate = new Date(dateStr);
				const weekday = currentDate.getDay(); // Matches DB convention: Sun=0, Mon=1..Sat=6

				// 1️⃣ Absence check (highest priority)
				const isAbsent = userAbsences.some((a) => {
					const start = new Date(a.start_time ?? '');
					const end = a.end_time ? new Date(a.end_time) : null;

					const dayStart = new Date(currentDate);
					dayStart.setHours(0, 0, 0, 0);

					const dayEnd = new Date(currentDate);
					dayEnd.setHours(23, 59, 59, 999);

					return start <= dayEnd && (!end || end >= dayStart);
				});
				if (isAbsent) {
					result[dateStr] = null;
					userBlockedDays[dateStr] = 'absence';
					continue;
				}

				// 2️⃣ Vacation check
				const isVacationDay = userVacations.some((v) => {
					const start = new Date(v.start_date ?? '');
					const end = new Date(v.end_date ?? '');
					return (
						currentDate.getTime() >= start.setHours(0, 0, 0, 0) &&
						currentDate.getTime() <= end.setHours(23, 59, 59, 999)
					);
				});
				if (isVacationDay) {
					result[dateStr] = null;
					userBlockedDays[dateStr] = 'vacation';
					continue;
				}

				// 3️⃣ Date-based override (fix timezone comparison)
				const dateSlots = userDateAvailabilities
					.filter((a) => {
						const dbDate = new Date(a.date ?? '').toLocaleDateString('sv-SE');
						return dbDate === dateStr;
					})
					.map((a) => ({ from: a.start_time ?? '', to: a.end_time ?? '' }));

				if (dateSlots.length > 0) {
					result[dateStr] = dateSlots;
					continue;
				}

				// 4️⃣ Weekly fallback
				const weekSlots = userWeeklyAvailabilities
					.filter((a) => a.weekday === weekday)
					.map((a) => ({ from: a.start_time ?? '', to: a.end_time ?? '' }));

				result[dateStr] = weekSlots.length > 0 ? weekSlots : null;
			}

			availability[userId] = result;
			blockedDays[userId] = userBlockedDays;
		}

		return json({ success: true, availability, blockedDays });
	} catch (err) {
		console.error('❌ Failed to fetch availability:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
