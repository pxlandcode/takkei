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
	trainerId?: number | null;
	clientId?: number | null;
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
			trainerId: null,
			clientId: null
		},
		bookings: []
	});

	/**
	 * Fetch & Update Bookings based on current filters
	 */
	async function refresh(fetchFn: typeof fetch) {
		let storeData;
		subscribe((store) => (storeData = store))();

		const newBookings = await fetchBookings(storeData.filters, fetchFn);

		update((store) => ({
			...store,
			bookings: newBookings
		}));
	}

	/**
	 * Update filters & fetch new bookings
	 */
	function updateFilters(newFilters: Partial<CalendarFilters>, fetchFn: typeof fetch) {
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
		const weekStart = new Date(date);
		const dayOfWeek = weekStart.getDay();

		// Adjust to Monday (if Sunday, go back 6 days)
		const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 2;
		weekStart.setDate(weekStart.getDate() - daysToSubtract);

		// Get Sunday (end of the week)
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekStart.getDate() + 7);

		const from = weekStart.toISOString().slice(0, 10);
		const to = weekEnd.toISOString().slice(0, 10);

		console.log('from', from);
		console.log('to', to);

		let storeData;
		subscribe((store) => (storeData = store))();

		updateFilters({ from, to, date: null }, fetchFn);

		refresh(fetchFn);
		console.log('storeData', storeData);
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
		updateFilters({ date, from: null, to: null }, fetchFn);
	}

	return {
		subscribe,
		refresh,
		goToWeek,
		goToNextWeek,
		goToPreviousWeek,
		goToDate
	};
};

export const calendarStore = createCalendarStore();
