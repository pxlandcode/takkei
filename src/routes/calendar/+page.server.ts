import type { PageServerLoad } from './$types';
import { fetchBookings } from '$lib/services/api/calendarService';
import type { CalendarFilters } from '$lib/stores/calendarStore';

/**
 * Load function to apply filters only on first visit.
 */
export const load: PageServerLoad = async ({ url, fetch }) => {
	// Check if this is the first visit (server-side, we assume it always is)
	const firstVisit = !url.searchParams.has('initialized');

	// Extract query parameters if first visit, otherwise set default
	const from = firstVisit ? url.searchParams.get('from') : null;
	const to = firstVisit ? url.searchParams.get('to') : null;
	const date = firstVisit ? url.searchParams.get('date') : new Date().toISOString().slice(0, 10);
	const roomId = firstVisit ? url.searchParams.get('roomId') : null;
	const locationIds = firstVisit ? url.searchParams.getAll('locationId').map(Number) : [];
	const trainerIds = firstVisit ? url.searchParams.getAll('trainerId').map(Number) : null;
	const clientIds = firstVisit ? url.searchParams.getAll('clientId').map(Number) : null;

	// Construct the filter object
	const filters: CalendarFilters = {
		from: from || null,
		to: to || null,
		date,
		roomId: roomId ? Number(roomId) : null,
		locationIds,
		trainerIds,
		clientIds
	};

	// Fetch bookings only if it's the first visit

	return {
		filters,
		firstVisit
	};
};
