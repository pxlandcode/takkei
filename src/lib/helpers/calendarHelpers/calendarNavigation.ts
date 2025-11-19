import type { CalendarFilters } from '$lib/stores/calendarStore';

function appendIdParams(
	params: URLSearchParams,
	list: number[] | null | undefined,
	key: string
) {
	if (!Array.isArray(list)) return;
	for (const value of list) {
		if (value == null || Number.isNaN(value)) continue;
		params.append(key, String(value));
	}
}

export function getCalendarUrl(filters: Partial<CalendarFilters>): string {
	const params = new URLSearchParams();

	if (filters.date) {
		params.set('date', filters.date);
	}
	if (filters.from) {
		params.set('from', filters.from);
	}
	if (filters.to) {
		params.set('to', filters.to);
	}
	if (filters.roomId != null && !Number.isNaN(filters.roomId)) {
		params.set('roomId', String(filters.roomId));
	}

	appendIdParams(params, filters.trainerIds, 'trainerId');
	appendIdParams(params, filters.locationIds, 'locationId');
	appendIdParams(params, filters.clientIds, 'clientId');
	appendIdParams(params, filters.userIds, 'userId');

	const query = params.toString();
	return query ? `/calendar?${query}` : '/calendar';
}
