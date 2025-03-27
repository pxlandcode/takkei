import { writable } from 'svelte/store';
import { fetchBookings } from '$lib/services/api/calendarService';

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
	const { subscribe, update } = writable<{ filters: CalendarFilters; bookings: any[] }>({
		filters: {
			from: null,
			to: null,
			date: new Date().toISOString().slice(0, 10), // Default: today
			roomId: null,
			locationIds: [],
			trainerIds: null,
			clientIds: null,
			personalBookings: false
		},
		bookings: []
	});

	/**
	 * Fetch & Update Bookings based on current filters
	 */
	async function refresh(fetchFn: typeof fetch) {
		let storeData;
		subscribe((store) => (storeData = store))();

		if (!storeData.filters.from && !storeData.filters.to) {
			const { weekStart, weekEnd } = getWeekStartAndEnd(new Date());
			storeData.filters.from = weekStart;
			storeData.filters.to = weekEnd;
		}

		// ✅ Only auto-set personalBookings if it wasn't explicitly set
		if (storeData.filters.personalBookings === undefined) {
			storeData.filters.personalBookings = storeData.filters.trainerIds?.length === 1;
		}

		const newBookings = await fetchBookings(storeData.filters, fetchFn);

		update((store) => ({
			...store,
			bookings: newBookings
		}));
	}

	function updateFilters(newFilters: Partial<CalendarFilters>, fetchFn: typeof fetch) {
		let storeData;
		subscribe((store) => (storeData = store))();

		console.log('[calendarStore] Updating filters:', newFilters);

		update((store) => ({
			...store,
			filters: {
				...store.filters,
				...newFilters,
				// ✅ Only auto-set if `personalBookings` wasn't explicitly set
				personalBookings: newFilters.personalBookings ?? newFilters.trainerIds?.length === 1
			}
		}));
		console.log('[calendarStore] Updated filters:', storeData.filters);

		refresh(fetchFn);
	}

	/**
	 * Set Week (from Monday → Sunday)
	 */
	function goToWeek(date: Date, fetchFn: typeof fetch) {
		const { weekStart, weekEnd } = getWeekStartAndEnd(new Date(date));
		const from = weekStart;
		const to = weekEnd;
		const formattedDate = date.toISOString().slice(0, 10);

		updateFilters({ from, to, date: formattedDate }, fetchFn);
	}

	function goToNextWeek(fetchFn: typeof fetch) {
		update((store) => {
			const currentDate = store.filters.from ? new Date(store.filters.from) : new Date();
			currentDate.setDate(currentDate.getDate() + 7); // Move forward one week

			const { weekStart, weekEnd } = getWeekStartAndEnd(currentDate);

			return {
				...store,
				filters: {
					...store.filters,
					from: weekStart,
					to: weekEnd,
					date: weekStart // Move the displayed date to the start of the new week
				}
			};
		});

		refresh(fetchFn);
	}

	function goToPreviousWeek(fetchFn: typeof fetch) {
		update((store) => {
			const currentDate = store.filters.from ? new Date(store.filters.from) : new Date();
			currentDate.setDate(currentDate.getDate() - 7); // Move backward one week

			const { weekStart, weekEnd } = getWeekStartAndEnd(currentDate);

			return {
				...store,
				filters: {
					...store.filters,
					from: weekStart,
					to: weekEnd,
					date: weekStart // Move the displayed date to the start of the new week
				}
			};
		});

		refresh(fetchFn);
	}

	function goToNextDay(fetchFn: typeof fetch) {
		let needsWeekUpdate = false;

		update((store) => {
			const currentDate = store.filters.date ? new Date(store.filters.date) : new Date();
			currentDate.setDate(currentDate.getDate() + 1); // Move forward one day

			const newDateStr = currentDate.toISOString().slice(0, 10);
			const { weekStart, weekEnd } = getWeekStartAndEnd(currentDate);

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

	function goToPreviousDay(fetchFn: typeof fetch) {
		let needsWeekUpdate = false;

		update((store) => {
			const currentDate = store.filters.date ? new Date(store.filters.date) : new Date();
			currentDate.setDate(currentDate.getDate() - 1); // Move backward one day

			const newDateStr = currentDate.toISOString().slice(0, 10);
			const { weekStart, weekEnd } = getWeekStartAndEnd(currentDate);

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
