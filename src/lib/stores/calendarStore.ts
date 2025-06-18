import { get, writable } from 'svelte/store';
import { fetchBookings, fetchUserAvailability } from '$lib/services/api/calendarService';

/**
 * Type for Calendar Filters
 */
export type CalendarFilters = {
	from?: string | null;
	to?: string | null;
	date?: string | null;
	roomId?: number | null;
	locationIds?: number[];
	trainerIds?: number[] | null;
	clientIds?: number[] | null;
	personalBookings?: boolean;
};

/**
 * Calendar Store - Manages filters & bookings
 */
const createCalendarStore = () => {
	const { subscribe, update } = writable<{
		filters: CalendarFilters;
		bookings: any[];
		availability: Record<string, { from: string; to: string }[] | null>;
	}>({
		filters: {
			from: null,
			to: null,
			date: new Date().toISOString().slice(0, 10),
			roomId: null,
			locationIds: [],
			trainerIds: null,
			clientIds: null,
			personalBookings: false
		},
		bookings: [],
		availability: {}
	});

	/**
	 * Fetch & Update Bookings based on current filters
	 */

	async function refresh(fetchFn: typeof fetch, overrideFilters?: CalendarFilters) {
		const filtersToUse = overrideFilters ?? getCurrentFilters();

		if (!filtersToUse.from && !filtersToUse.to) {
			const { weekStart, weekEnd } = getWeekStartAndEnd(new Date());
			filtersToUse.from = weekStart;
			filtersToUse.to = weekEnd;
		}

		if (filtersToUse.personalBookings === undefined) {
			filtersToUse.personalBookings = filtersToUse.trainerIds?.length === 1;
		}

		const newBookings = await fetchBookings(filtersToUse, fetchFn);

		let newAvailability = {};
		if (filtersToUse.trainerIds?.length === 1 && filtersToUse.from && filtersToUse.to) {
			const userId = filtersToUse.trainerIds[0];
			try {
				const res = await fetchUserAvailability(
					userId,
					filtersToUse.from,
					filtersToUse.to,
					fetchFn
				);
				newAvailability = res.availability ?? {};
			} catch (err) {
				console.error('❌ Failed to fetch availability:', err);
			}
		}

		update((store) => ({
			...store,
			bookings: newBookings,
			availability: newAvailability
		}));
	}

	function getCurrentFilters(): CalendarFilters {
		let current;
		subscribe((s) => (current = s))();
		return current.filters;
	}

	function updateFilters(newFilters: Partial<CalendarFilters>, fetchFn: typeof fetch) {
		const updatedFilters = {
			...getCurrentFilters(),
			...newFilters,
			personalBookings: newFilters.personalBookings ?? newFilters.trainerIds?.length === 1
		};

		update((store) => ({
			...store,
			filters: updatedFilters
		}));

		refresh(fetchFn, updatedFilters); // ← pass directly
	}

	/**
	 * Set Week (from Monday → Sunday)
	 */
	function goToWeek(date: Date, fetchFn: typeof fetch) {
		const { weekStart, weekEnd } = getWeekStartAndEnd(new Date(date));
		const from = weekStart;
		const to = weekEnd;
		const formattedDate = date.toISOString().slice(0, 10);

		const currentFilters = getCurrentFilters();

		updateFilters(
			{
				...currentFilters,
				from,
				to,
				date: formattedDate
			},
			fetchFn
		);
	}
	function goToNextWeek(fetchFn: typeof fetch) {
		const currentFilters = getCurrentFilters();
		const currentDate = currentFilters.from ? new Date(currentFilters.from) : new Date();

		currentDate.setDate(currentDate.getDate() + 7); // Move forward one week
		const { weekStart, weekEnd } = getWeekStartAndEnd(currentDate);

		updateFilters(
			{
				...currentFilters,
				from: weekStart,
				to: weekEnd,
				date: weekStart
			},
			fetchFn
		);
	}

	function goToPreviousWeek(fetchFn: typeof fetch) {
		const currentFilters = getCurrentFilters();
		const currentDate = currentFilters.from ? new Date(currentFilters.from) : new Date();

		currentDate.setDate(currentDate.getDate() - 7); // Move back one week
		const { weekStart, weekEnd } = getWeekStartAndEnd(currentDate);

		updateFilters(
			{
				...currentFilters,
				from: weekStart,
				to: weekEnd,
				date: weekStart
			},
			fetchFn
		);
	}

	function goToNextDay(fetchFn: typeof fetch) {
		const currentFilters = getCurrentFilters();
		const currentDate = currentFilters.date ? new Date(currentFilters.date) : new Date();

		currentDate.setDate(currentDate.getDate() + 1); // Move forward one day
		const newDateStr = currentDate.toISOString().slice(0, 10);

		const { weekStart, weekEnd } = getWeekStartAndEnd(currentDate);
		const needsWeekUpdate = newDateStr < currentFilters.from || newDateStr > currentFilters.to;

		updateFilters(
			{
				...currentFilters,
				date: newDateStr,
				...(needsWeekUpdate ? { from: weekStart, to: weekEnd } : {})
			},
			fetchFn
		);
	}

	function goToPreviousDay(fetchFn: typeof fetch) {
		const currentFilters = getCurrentFilters();
		const currentDate = currentFilters.date ? new Date(currentFilters.date) : new Date();

		currentDate.setDate(currentDate.getDate() - 1); // Move back one day
		const newDateStr = currentDate.toISOString().slice(0, 10);

		const { weekStart, weekEnd } = getWeekStartAndEnd(currentDate);
		const needsWeekUpdate = newDateStr < currentFilters.from || newDateStr > currentFilters.to;

		updateFilters(
			{
				...currentFilters,
				date: newDateStr,
				...(needsWeekUpdate ? { from: weekStart, to: weekEnd } : {})
			},
			fetchFn
		);
	}

	/**
	 * Set Specific Date (Single Day View)
	 */
	function goToDate(date: Date, fetchFn: typeof fetch) {
		let needsWeekUpdate: boolean = false;
		update((store) => {
			const newDateStr = date.toISOString().slice(0, 10);
			const { weekStart, weekEnd } = getWeekStartAndEnd(date);

			// Check if the new date is outside the current week range
			needsWeekUpdate = newDateStr < store.filters.from || newDateStr > store.filters.to;

			return {
				...store,
				filters: {
					...store.filters,
					date: newDateStr,
					...(needsWeekUpdate ? { from: weekStart, to: weekEnd } : {})
				}
			};
		});

		if (needsWeekUpdate) {
			refresh(fetchFn);
		}
	}

	return {
		subscribe,
		refresh,
		goToWeek,
		goToNextWeek,
		goToPreviousWeek,
		goToNextDay,
		goToPreviousDay,
		goToDate,
		updateFilters
	};
};

export const calendarStore = createCalendarStore();

export function getWeekStartAndEnd(date: Date) {
	const givenDate = new Date(date);

	// Get the day of the week (0 = Sunday, 6 = Saturday)
	const dayOfWeek = givenDate.getDay();

	// Adjust to start the week on Monday
	const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	const weekStart = new Date(givenDate);
	weekStart.setDate(givenDate.getDate() + diffToMonday);

	// Calculate week end (Sunday)
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekStart.getDate() + 7);

	return {
		weekStart: weekStart.toISOString().split('T')[0],
		weekEnd: weekEnd.toISOString().split('T')[0]
	};
}
