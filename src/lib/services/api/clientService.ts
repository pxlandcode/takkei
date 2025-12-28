import type { Client } from '$lib/types/clientTypes';
import type { FullBooking, BookingFilters } from '$lib/types/calendarTypes';
import { fetchBookings } from '$lib/services/api/calendarService';
import { wrapFetch } from '$lib/services/api/apiCache';

/**
 * Fetch Client Details and Bookings Using `fetchBookings`
 */
export async function fetchClient(
	clientId: number,
	fetchFn: typeof fetch
): Promise<{ client: Client; bookings: FullBooking[] } | null> {
	const cachedFetch = wrapFetch(fetchFn);

	try {
		// Fetch client details
		const clientResponse = await cachedFetch(`/api/clients/${clientId}`);
		if (!clientResponse.ok) throw new Error('Client not found');
		const clientData: Client = await clientResponse.json();

		// Define filters for the last year
		const today = new Date();
		today.setDate(new Date().getDate() + 1);

		const lastYear = new Date();
		const nextYear = new Date();
		lastYear.setFullYear(lastYear.getFullYear() - 1);
		nextYear.setFullYear(nextYear.getFullYear() + 1);
		const toDate = nextYear.toISOString().slice(0, 10);
		const fromDate = lastYear.toISOString().slice(0, 10);

		const bookingFilters: BookingFilters = {
			from: fromDate,
			to: toDate,
			clientIds: [clientId],
			personalBookings: false
		};

		const bookingsData: FullBooking[] = await fetchBookings(bookingFilters, fetchFn);

		return { client: clientData, bookings: bookingsData };
	} catch (error) {
		console.error('Error fetching client:', error);
		return null;
	}
}
