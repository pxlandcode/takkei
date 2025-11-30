import { writable } from 'svelte/store';
import { fetchBookings, fetchUserAvailability } from '$lib/services/api/calendarService';
import { fetchHolidays as fetchHolidayRange } from '$lib/services/api/holidayService';
import type { FullBooking } from '$lib/types/calendarTypes';
import type { Holiday } from '$lib/types/holiday';
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
	userIds?: number[] | null;
	personalBookings?: boolean;
};

const FILTER_COOKIE_NAME = 'calendarFilters';
const FILTER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const isBrowser = typeof window !== 'undefined';

function createDefaultFilters(): CalendarFilters {
	return {
		from: null,
		to: null,
		date: new Date().toISOString().slice(0, 10),
		roomId: null,
		locationIds: [],
		trainerIds: null,
		clientIds: null,
		userIds: null,
		personalBookings: false
	};
}

function sanitizeFiltersFromCookie(data: unknown): CalendarFilters | null {
	if (!data || typeof data !== 'object') return null;
	const obj = data as Record<string, unknown>;
	const base = createDefaultFilters();
	const sanitizeNumberArray = (value: unknown): number[] =>
		Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : [];
	const sanitizeNullableNumberArray = (value: unknown): number[] | null | undefined => {
		if (value === null) return null;
		return Array.isArray(value)
			? value.filter((id): id is number => typeof id === 'number')
			: undefined;
	};

	const trainerIds =
		sanitizeNullableNumberArray(obj.trainerIds) ?? base.trainerIds ?? null;
	const clientIds =
		sanitizeNullableNumberArray(obj.clientIds) ?? base.clientIds ?? null;
	const userIds = sanitizeNullableNumberArray(obj.userIds) ?? base.userIds ?? null;

	return {
		...base,
		from: typeof obj.from === 'string' || obj.from === null ? (obj.from as string | null) : base.from,
		to: typeof obj.to === 'string' || obj.to === null ? (obj.to as string | null) : base.to,
		date: typeof obj.date === 'string' ? obj.date : base.date,
		roomId:
			typeof obj.roomId === 'number' || obj.roomId === null ? (obj.roomId as number | null) : base.roomId,
		locationIds: Array.isArray(obj.locationIds)
			? sanitizeNumberArray(obj.locationIds)
			: base.locationIds,
		trainerIds,
		clientIds,
		userIds,
		personalBookings:
			typeof obj.personalBookings === 'boolean' ? obj.personalBookings : base.personalBookings
	};
}

function loadFiltersFromCookie(): CalendarFilters | null {
	if (!isBrowser) return null;
	const rawCookie = document.cookie
		.split(';')
		.map((cookie) => cookie.trim())
		.find((cookie) => cookie.startsWith(`${FILTER_COOKIE_NAME}=`));

	if (!rawCookie) return null;

	try {
		const value = decodeURIComponent(rawCookie.slice(FILTER_COOKIE_NAME.length + 1));
		const parsed = JSON.parse(value);
		return sanitizeFiltersFromCookie(parsed);
	} catch (err) {
		console.error('❌ Failed to parse calendar filters from cookie:', err);
		return null;
	}
}

function persistFiltersToCookie(filters: CalendarFilters): void {
	if (!isBrowser) return;
	try {
		const encoded = encodeURIComponent(JSON.stringify(filters));
		document.cookie = `${FILTER_COOKIE_NAME}=${encoded};path=/;max-age=${FILTER_COOKIE_MAX_AGE_SECONDS};SameSite=Lax`;
	} catch (err) {
		console.error('❌ Failed to persist calendar filters to cookie:', err);
	}
}

function getTrainerFilterCount(f: CalendarFilters | undefined): number {
	if (!Array.isArray(f?.trainerIds)) return 0;
	return f.trainerIds.filter((id): id is number => typeof id === 'number').length;
}

function computePersonalBookingsFlag(f: CalendarFilters): boolean {
	const trainerCount = getTrainerFilterCount(f);
	const allowMultipleTrainers = trainerCount >= 1 && trainerCount <= 5;
	const noClients = !Array.isArray(f?.clientIds) || f.clientIds.length === 0;
	const noLocations = !Array.isArray(f?.locationIds) || f.locationIds.length === 0;
	const noRoom = f?.roomId == null;
	return allowMultipleTrainers && noClients && noLocations && noRoom;
}

/**
 * Calendar Store - Manages filters & bookings
 */
type CalendarAvailability = Record<string, { from: string; to: string }[] | null>;

type CalendarStoreState = {
        filters: CalendarFilters;
        bookings: FullBooking[];
	availability: CalendarAvailability;
	holidays: Holiday[];
	holidaySet: Set<string>;
	isLoading: boolean;
};

const createCalendarStore = () => {
	const initialFilters = loadFiltersFromCookie() ?? createDefaultFilters();
	if (initialFilters.personalBookings === undefined) {
		initialFilters.personalBookings = computePersonalBookingsFlag(initialFilters);
	}

        const { subscribe, update } = writable<CalendarStoreState>({
                filters: initialFilters,
                bookings: [],
                availability: {},
                holidays: [],
                holidaySet: new Set(),
                isLoading: false
        });

	let pendingRequests = 0;
	let latestRequestId = 0;

	function setFiltersState(nextFilters: CalendarFilters) {
		update((store) => ({ ...store, filters: nextFilters }));
		persistFiltersToCookie(nextFilters);
	}

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

        async function refresh(fetchFn: typeof fetch, overrideFilters?: CalendarFilters): Promise<void> {
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

                update((store) => ({ ...store, holidays: [], holidaySet: new Set() }));
                startLoading();

                try {
                        const bookingsPromise = fetchBookings(base, fetchFn);
                        const availabilityPromise: Promise<CalendarAvailability> =
                                base.trainerIds?.length === 1 && base.from && base.to
                                        ? fetchUserAvailability(base.trainerIds[0], base.from, base.to, fetchFn)
                                                        .then((res) => res.availability ?? {})
                                                        .catch((err) => {
                                                                console.error('❌ Failed to fetch availability:', err);
                                                                return {} as CalendarAvailability;
                                                        })
                                        : Promise.resolve({} as CalendarAvailability);

                        const rangeFrom = base.from ?? base.date ?? new Date().toISOString().slice(0, 10);
                        const rangeTo = base.to ?? base.date ?? rangeFrom;
                        const holidaysPromise: Promise<Holiday[]> = fetchHolidayRange(
                                { from: rangeFrom, to: rangeTo },
                                fetchFn
                        ).catch((err) => {
                                console.error('❌ Failed to fetch holidays:', err);
                                return [];
                        });

                        const [newBookings, newAvailability, newHolidays] = await Promise.all([
                                bookingsPromise,
                                availabilityPromise,
                                holidaysPromise
                        ]);

                        if (requestId === latestRequestId) {
                                update((store) => ({
                                        ...store,
                                        bookings: newBookings,
                                        availability: newAvailability,
                                        holidays: newHolidays,
                                        holidaySet: new Set(newHolidays.map((holiday) => holiday.date))
                                }));
                        }
                } catch (err) {
                        if (requestId === latestRequestId) {
                                console.error('❌ Failed to refresh calendar data:', err);
                                update((store) => ({ ...store, holidays: [], holidaySet: new Set() }));
                        }
                } finally {
                        stopLoading();
                }
        }

	function getCurrentFilters(): CalendarFilters {
		let snapshot: CalendarStoreState | undefined;
		const unsubscribe = subscribe((state) => {
			snapshot = state;
		});
		unsubscribe();
		return snapshot?.filters ?? createDefaultFilters();
	}

	async function updateFilters(
		newFilters: Partial<CalendarFilters>,
		fetchFn: typeof fetch
	): Promise<void> {
		const merged = { ...getCurrentFilters(), ...newFilters };

		if (newFilters.personalBookings === undefined) {
			merged.personalBookings = computePersonalBookingsFlag(merged);
		}

		setFiltersState(merged);
		await refresh(fetchFn, merged);
	}

	async function setNewFilters(
		newFilters: Partial<CalendarFilters>,
		fetchFn: typeof fetch
	): Promise<void> {
		const baseDefaults: CalendarFilters = {
			...createDefaultFilters(),
			personalBookings: undefined
		};

		const filters = { ...baseDefaults, ...newFilters };
		if (filters.personalBookings === undefined) {
			filters.personalBookings = computePersonalBookingsFlag(filters);
		}

		setFiltersState(filters);
		await refresh(fetchFn, filters);
	}
	/**
	 * Set Week (from Monday → Sunday)
	 */
	async function goToWeek(date: Date, fetchFn: typeof fetch): Promise<void> {
		const { weekStart, weekEnd } = getWeekStartAndEnd(new Date(date));
		const from = weekStart;
		const to = weekEnd;
		const formattedDate = date.toISOString().slice(0, 10);

		const currentFilters = getCurrentFilters();

		await updateFilters(
			{
				...currentFilters,
				from,
				to,
				date: formattedDate
			},
			fetchFn
		);
	}

	async function goToNextMonth(fetchFn: typeof fetch): Promise<void> {
		const currentFilters = getCurrentFilters();
		const baseDate = currentFilters.date ? new Date(currentFilters.date) : new Date();

		// Move forward one month
		baseDate.setMonth(baseDate.getMonth() + 1);

		// Keep day in range for shorter months (e.g., Jan 31 → Feb 28)
		if (baseDate.getDate() !== parseInt(currentFilters.date?.split('-')[2] ?? '1')) {
			baseDate.setDate(1);
		}

		const { weekStart, weekEnd } = getWeekStartAndEnd(baseDate);

		await updateFilters(
			{
				...currentFilters,
				from: weekStart,
				to: weekEnd,
				date: baseDate.toISOString().slice(0, 10)
			},
			fetchFn
		);
	}

	async function goToPreviousMonth(fetchFn: typeof fetch): Promise<void> {
		const currentFilters = getCurrentFilters();
		const baseDate = currentFilters.date ? new Date(currentFilters.date) : new Date();

		// Move back one month
		baseDate.setMonth(baseDate.getMonth() - 1);

		// Keep day in range for shorter months
		if (baseDate.getDate() !== parseInt(currentFilters.date?.split('-')[2] ?? '1')) {
			baseDate.setDate(1);
		}

		const { weekStart, weekEnd } = getWeekStartAndEnd(baseDate);

		await updateFilters(
			{
				...currentFilters,
				from: weekStart,
				to: weekEnd,
				date: baseDate.toISOString().slice(0, 10)
			},
			fetchFn
		);
	}

	async function goToNextWeek(fetchFn: typeof fetch): Promise<void> {
		const currentFilters = getCurrentFilters();
		const currentDate = currentFilters.from ? new Date(currentFilters.from) : new Date();

		currentDate.setDate(currentDate.getDate() + 7); // Move forward one week
		const { weekStart, weekEnd } = getWeekStartAndEnd(currentDate);

		await updateFilters(
			{
				...currentFilters,
				from: weekStart,
				to: weekEnd,
				date: weekStart
			},
			fetchFn
		);
	}

	async function goToPreviousWeek(fetchFn: typeof fetch): Promise<void> {
		const currentFilters = getCurrentFilters();
		const currentDate = currentFilters.from ? new Date(currentFilters.from) : new Date();

		currentDate.setDate(currentDate.getDate() - 7); // Move back one week
		const { weekStart, weekEnd } = getWeekStartAndEnd(currentDate);

		await updateFilters(
			{
				...currentFilters,
				from: weekStart,
				to: weekEnd,
				date: weekStart
			},
			fetchFn
		);
	}

	async function goToNextDay(fetchFn: typeof fetch): Promise<void> {
		const currentFilters = getCurrentFilters();
		const currentDate = currentFilters.date ? new Date(currentFilters.date) : new Date();

		currentDate.setDate(currentDate.getDate() + 1); // Move forward one day
		const newDateStr = currentDate.toISOString().slice(0, 10);

		const { weekStart, weekEnd } = getWeekStartAndEnd(currentDate);
		const needsWeekUpdate =
			!currentFilters.from ||
			!currentFilters.to ||
			newDateStr < currentFilters.from ||
			newDateStr > currentFilters.to;

		await updateFilters(
			{
				...currentFilters,
				date: newDateStr,
				...(needsWeekUpdate ? { from: weekStart, to: weekEnd } : {})
			},
			fetchFn
		);
	}

	async function goToPreviousDay(fetchFn: typeof fetch): Promise<void> {
		const currentFilters = getCurrentFilters();
		const currentDate = currentFilters.date ? new Date(currentFilters.date) : new Date();

		currentDate.setDate(currentDate.getDate() - 1); // Move back one day
		const newDateStr = currentDate.toISOString().slice(0, 10);

		const { weekStart, weekEnd } = getWeekStartAndEnd(currentDate);
		const needsWeekUpdate =
			!currentFilters.from ||
			!currentFilters.to ||
			newDateStr < currentFilters.from ||
			newDateStr > currentFilters.to;

		await updateFilters(
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
	async function goToDate(date: Date, fetchFn: typeof fetch): Promise<void> {
		const currentFilters = getCurrentFilters();
		const newDateStr = date.toISOString().slice(0, 10);
		const { weekStart, weekEnd } = getWeekStartAndEnd(date);

		const needsWeekUpdate =
			!currentFilters.from ||
			!currentFilters.to ||
			newDateStr < currentFilters.from ||
			newDateStr > currentFilters.to;

		const nextFilters: CalendarFilters = {
			...currentFilters,
			date: newDateStr,
			...(needsWeekUpdate ? { from: weekStart, to: weekEnd } : {})
		};

		setFiltersState(nextFilters);

		if (needsWeekUpdate) {
			await refresh(fetchFn);
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
	// Work with local dates to avoid timezone issues
	const year = date.getFullYear();
	const month = date.getMonth();
	const day = date.getDate();
	const localDate = new Date(year, month, day, 12, 0, 0);

	// Get the day of the week (0 = Sunday, 6 = Saturday)
	const dayOfWeek = localDate.getDay();

	// Adjust to start the week on Monday
	const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	const weekStart = new Date(localDate);
	weekStart.setDate(localDate.getDate() + diffToMonday);

	// Calculate week end (next Monday, exclusive)
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekStart.getDate() + 7);

	// Format as YYYY-MM-DD using local date
	const formatDate = (d: Date) => {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	};

	return {
		weekStart: formatDate(weekStart),
		weekEnd: formatDate(weekEnd)
	};
}
