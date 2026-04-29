import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/db';
import { respondJsonWithEtag } from '$lib/server/http-cache';
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

type AvailabilitySlot = { from: string; to: string };
type DayInfo = { key: string; weekday: number };

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

function parseLocalDate(input: string): Date {
	const [year, month, day] = input.split('-').map(Number);
	return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toDateKey(value: string | Date | null | undefined): string | null {
	if (!value) return null;
	if (typeof value === 'string') {
		const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
		if (match) return match[1] ?? null;
	}

	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function buildDayInfos(from: string, to: string): DayInfo[] {
	const startDate = parseLocalDate(from);
	const endDate = parseLocalDate(to);
	const days: DayInfo[] = [];

	for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
		const key = toDateKey(d);
		if (!key) continue;
		days.push({ key, weekday: d.getDay() });
	}

	return days;
}

function indexWeeklySlots(rows: AvailabilityRow[]): Map<number, AvailabilitySlot[]> {
	const indexed = new Map<number, AvailabilitySlot[]>();
	for (const row of rows) {
		const weekday = row.weekday;
		if (weekday == null || !row.start_time || !row.end_time) continue;
		const existing = indexed.get(weekday);
		if (existing) {
			existing.push({ from: row.start_time, to: row.end_time });
		} else {
			indexed.set(weekday, [{ from: row.start_time, to: row.end_time }]);
		}
	}
	return indexed;
}

function indexDateSlots(rows: AvailabilityRow[]): Map<string, AvailabilitySlot[]> {
	const indexed = new Map<string, AvailabilitySlot[]>();
	for (const row of rows) {
		const key = toDateKey(row.date);
		if (!key || !row.start_time || !row.end_time) continue;
		const existing = indexed.get(key);
		if (existing) {
			existing.push({ from: row.start_time, to: row.end_time });
		} else {
			indexed.set(key, [{ from: row.start_time, to: row.end_time }]);
		}
	}
	return indexed;
}

function markBlockedDays(
	target: UserBlockedDaysMap,
	rows: AvailabilityRow[],
	from: string,
	to: string,
	reason: 'vacation' | 'absence'
) {
	const rangeStart = parseLocalDate(from);
	rangeStart.setHours(0, 0, 0, 0);
	const rangeEnd = parseLocalDate(to);
	rangeEnd.setHours(23, 59, 59, 999);

	for (const row of rows) {
		const rawStart = reason === 'vacation' ? row.start_date : row.start_time;
		const rawEnd = reason === 'vacation' ? row.end_date : row.end_time;
		if (!rawStart) continue;

		const start = rawStart instanceof Date ? new Date(rawStart) : new Date(rawStart);
		const end = rawEnd
			? rawEnd instanceof Date
				? new Date(rawEnd)
				: new Date(rawEnd)
			: new Date(rangeEnd);
		if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

		start.setHours(0, 0, 0, 0);
		end.setHours(23, 59, 59, 999);

		const effectiveStart = start < rangeStart ? new Date(rangeStart) : start;
		const effectiveEnd = end > rangeEnd ? new Date(rangeEnd) : end;
		if (effectiveStart > effectiveEnd) continue;

		for (
			let current = new Date(effectiveStart);
			current <= effectiveEnd;
			current.setDate(current.getDate() + 1)
		) {
			const key = toDateKey(current);
			if (!key) continue;
			target[key] = reason;
		}
	}
}

export const GET: RequestHandler = async ({ url, request }) => {
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
		const dayInfos = buildDayInfos(from, to);

		const [weeklyAvailabilities, dateAvailabilities, vacations, absences] = (await Promise.all([
			query(
				`SELECT user_id, weekday, start_time, end_time
				 FROM weekly_availabilities
				 WHERE user_id = ANY($1::int[])`,
				[userIds]
			),
			query(
				`SELECT user_id, date, start_time, end_time
				 FROM date_availabilities
	             WHERE user_id = ANY($1::int[]) AND date BETWEEN $2 AND $3 AND available = true`,
				[userIds, from, to]
			),
			query(
				`SELECT user_id, start_date, end_date
				 FROM vacations
	             WHERE user_id = ANY($1::int[]) AND NOT (end_date < $2 OR start_date > $3)`,
				[userIds, from, to]
			),
			query(
				`SELECT user_id, start_time, end_time
				 FROM absences
				 WHERE user_id = ANY($1::int[]) AND (
				   (start_time <= $3 AND end_time >= $2)
				   OR (start_time <= $3 AND end_time IS NULL)
				 )`,
				[userIds, from, to]
			)
		])) as [AvailabilityRow[], AvailabilityRow[], AvailabilityRow[], AvailabilityRow[]];

		const weeklyByUser = groupRowsByUser(weeklyAvailabilities);
		const dateByUser = groupRowsByUser(dateAvailabilities);
		const vacationsByUser = groupRowsByUser(vacations);
		const absencesByUser = groupRowsByUser(absences);

		const availability: UsersAvailabilityResponse['availability'] = {};
		const blockedDays: UsersAvailabilityResponse['blockedDays'] = {};

		for (const userId of userIds) {
			const result: UserAvailabilityMap = {};
			const userBlockedDays: UserBlockedDaysMap = {};
			const userWeeklySlots = indexWeeklySlots(weeklyByUser.get(userId) ?? []);
			const userDateSlots = indexDateSlots(dateByUser.get(userId) ?? []);

			markBlockedDays(userBlockedDays, vacationsByUser.get(userId) ?? [], from, to, 'vacation');
			markBlockedDays(userBlockedDays, absencesByUser.get(userId) ?? [], from, to, 'absence');

			for (const day of dayInfos) {
				if (userBlockedDays[day.key]) {
					result[day.key] = null;
					continue;
				}

				const dateSlots = userDateSlots.get(day.key);
				if (dateSlots && dateSlots.length > 0) {
					result[day.key] = dateSlots;
					continue;
				}

				const weekSlots = userWeeklySlots.get(day.weekday) ?? [];
				result[day.key] = weekSlots.length > 0 ? weekSlots : null;
			}

			availability[userId] = result;
			blockedDays[userId] = userBlockedDays;
		}

		return respondJsonWithEtag(request, { success: true, availability, blockedDays });
	} catch (err) {
		console.error('❌ Failed to fetch availability:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
