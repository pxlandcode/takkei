import { writable } from 'svelte/store';
import { fetchBookings, fetchUserAvailability } from '$lib/services/api/calendarService';
import type { FullBooking } from '$lib/types/calendarTypes';
import { loadingStore } from './loading';

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

function computePersonalBookingsFlag(f: CalendarFilters): boolean {
	const oneTrainer = Array.isArray(f?.trainerIds) && f.trainerIds.length === 1;
	const noClients = !Array.isArray(f?.clientIds) || f.clientIds.length === 0;
	const noLocations = !Array.isArray(f?.locationIds) || f.locationIds.length === 0;
	const noRoom = f?.roomId == null;
	return oneTrainer && noClients && noLocations && noRoom;
}

/**
 * Calendar Store - Manages filters & bookings
 */
type CalendarAvailability = Record<string, { from: string; to: string }[] | null>;

type CalendarStoreState = {
	filters: CalendarFilters;
	bookings: FullBooking[];
	availability: CalendarAvailability;
	isLoading: boolean;
};

const isBrowser = typeof window !== 'undefined';

const createCalendarStore = () => {
	const { subscribe, update } = writable<CalendarStoreState>({
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
		availability: {},
		isLoading: false
	});

	let pendingRequests = 0;
	let latestRequestId = 0;

	function startLoading(text: string = 'Hämtar kalender...') {
		pendingRequests += 1;
		if (pendingRequests === 1) {
			update((store) => ({ ...store, isLoading: true }));
			if (isBrowser) {
				loadingStore.loading(true, text);
			}
		}
	}

	function stopLoading() {
		if (pendingRequests === 0) return;
		pendingRequests -= 1;
		if (pendingRequests === 0) {
			update((store) => ({ ...store, isLoading: false }));
			if (isBrowser) {
				loadingStore.loading(false);
			}
		}
	}

	/**
	 * Fetch & Update Bookings based on current filters
	 */

	async function refresh(fetchFn: typeof fetch, overrideFilters?: CalendarFilters) {
		const requestId = ++latestRequestId;
		const base = { ...(overrideFilters ?? getCurrentFilters()) };

		if (!base.from && !base.to) {
			const { weekStart, weekEnd } = getWeekStartAndEnd(new Date());
			base.from = weekStart;
			base.to = weekEnd;
		}

		if (base.personalBookings === undefined) {
			base.personalBookings = computePersonalBookingsFlag(base);
		}

		startLoading();

		try {
			const bookingsPromise = fetchBookings(base, fetchFn);
			const availabilityPromise: Promise<CalendarAvailability> = base.trainerIds?.length === 1 && base.from && base.to
				? fetchUserAvailability(base.trainerIds[0], base.from, base.to, fetchFn)
						.then((res) => res.availability ?? {})
						.catch((err) => {
							console.error('❌ Failed to fetch availability:', err);
							return {} as CalendarAvailability;
						})
				: Promise.resolve({} as CalendarAvailability);

			const [newBookings, newAvailability] = await Promise.all([bookingsPromise, availabilityPromise]);

			if (requestId === latestRequestId) {
				update((store) => ({
					...store,
					bookings: newBookings,
					availability: newAvailability
				}));
			}
		} catch (err) {
			if (requestId === latestRequestId) {
				console.error('❌ Failed to refresh calendar data:', err);
			}
		} finally {
			stopLoading();
		}
	}

	function getCurrentFilters(): CalendarFilters {
		let current: CalendarStoreState;
		subscribe((s) => (current = s))();
		return current.filters;
	}

	function updateFilters(newFilters: Partial<CalendarFilters>, fetchFn: typeof fetch) {
		const merged = { ...getCurrentFilters(), ...newFilters };

		if (newFilters.personalBookings === undefined) {
			merged.personalBookings = computePersonalBookingsFlag(merged);
		}

		update((store) => ({ ...store, filters: merged }));
		refresh(fetchFn, merged);
	}

	function setNewFilters(newFilters: Partial<CalendarFilters>, fetchFn: typeof fetch) {
		const baseDefaults: CalendarFilters = {
			from: null,
			to: null,
			date: new Date().toISOString().slice(0, 10),
			roomId: null,
			locationIds: [],
			trainerIds: null,
			clientIds: null,
			personalBookings: undefined
		};

		const filters = { ...baseDefaults, ...newFilters };
		if (filters.personalBookings === undefined) {
			filters.personalBookings = computePersonalBookingsFlag(filters);
		}

		update((store) => ({ ...store, filters }));
		refresh(fetchFn, filters);
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

	function goToNextMonth(fetchFn: typeof fetch) {
		const currentFilters = getCurrentFilters();
		const baseDate = currentFilters.date ? new Date(currentFilters.date) : new Date();

		// Move forward one month
		baseDate.setMonth(baseDate.getMonth() + 1);

		// Keep day in range for shorter months (e.g., Jan 31 → Feb 28)
		if (baseDate.getDate() !== parseInt(currentFilters.date?.split('-')[2] ?? '1')) {
			baseDate.setDate(1);
		}

		const { weekStart, weekEnd } = getWeekStartAndEnd(baseDate);

		updateFilters(
			{
				...currentFilters,
				from: weekStart,
				to: weekEnd,
				date: baseDate.toISOString().slice(0, 10)
			},
			fetchFn
		);
	}

	function goToPreviousMonth(fetchFn: typeof fetch) {
		const currentFilters = getCurrentFilters();
		const baseDate = currentFilters.date ? new Date(currentFilters.date) : new Date();

		// Move back one month
		baseDate.setMonth(baseDate.getMonth() - 1);

		// Keep day in range for shorter months
		if (baseDate.getDate() !== parseInt(currentFilters.date?.split('-')[2] ?? '1')) {
			baseDate.setDate(1);
		}

		const { weekStart, weekEnd } = getWeekStartAndEnd(baseDate);

		updateFilters(
			{
				...currentFilters,
				from: weekStart,
				to: weekEnd,
				date: baseDate.toISOString().slice(0, 10)
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
		updateFilters,
		setNewFilters,
		goToNextMonth,
		goToPreviousMonth
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
