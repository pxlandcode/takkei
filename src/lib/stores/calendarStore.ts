import { writable } from 'svelte/store';
import { fetchBookings } from '$lib/services/api/calendarService';
import { user } from './userStore';

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
			clientIds: null
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

		const newBookings = await fetchBookings(storeData.filters, fetchFn);

		update((store) => ({
			...store,
			bookings: newBookings
		}));

		console.log('Bookings:', newBookings);
	}

	/**
	 * Update filters & fetch new bookings
	 */
	function updateFilters(newFilters: Partial<CalendarFilters>, fetchFn: typeof fetch) {
		let storeData;
		subscribe((store) => (storeData = store))();
		console.log('storeData', storeData);
		update((store) => ({
			...store,
			filters: {
				...store.filters,
				...newFilters
			}
		}));

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

	/**
	 * Set Next Week
	 */
	function goToNextWeek(fetchFn: typeof fetch) {
		update((store) => {
			const fromDate = store.filters.from ? new Date(store.filters.from) : new Date();
			fromDate.setDate(fromDate.getDate() + 7);

			const toDate = new Date(fromDate);
			toDate.setDate(toDate.getDate() + 6);

			return {
				...store,
				filters: {
					...store.filters,
					from: fromDate.toISOString().slice(0, 10),
					to: toDate.toISOString().slice(0, 10),
					date: null
				}
			};
		});

		refresh(fetchFn);
	}

	/**
	 * Set Previous Week
	 */
	function goToPreviousWeek(fetchFn: typeof fetch) {
		update((store) => {
			const fromDate = store.filters.from ? new Date(store.filters.from) : new Date();
			fromDate.setDate(fromDate.getDate() - 7);

			const toDate = new Date(fromDate);
			toDate.setDate(toDate.getDate() + 6);

			return {
				...store,
				filters: {
					...store.filters,
					from: fromDate.toISOString().slice(0, 10),
					to: toDate.toISOString().slice(0, 10),
					date: null
				}
			};
		});

		refresh(fetchFn);
	}

	/**
	 * Set Specific Date (Single Day View)
	 */
	function goToDate(date: Date, fetchFn: typeof fetch) {
		const formattedDate = date.toISOString().slice(0, 10);
		const { weekStart, weekEnd } = getWeekStartAndEnd(date);
		updateFilters({ date: formattedDate, from: weekStart, to: weekEnd }, fetchFn);
	}

	return {
		subscribe,
		refresh,
		goToWeek,
		goToNextWeek,
		goToPreviousWeek,
		goToDate,
		updateFilters
	};
};

export const calendarStore = createCalendarStore();

function getWeekStartAndEnd(date: Date) {
	const givenDate = new Date(date);

	// Get the day of the week (0 = Sunday, 6 = Saturday)
	const dayOfWeek = givenDate.getDay();

	// Adjust to start the week on Monday
	const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek) + 1;
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
