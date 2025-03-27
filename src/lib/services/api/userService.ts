import type { User } from '$lib/types/userTypes';
import type { FullBooking, BookingFilters } from '$lib/types/calendarTypes';
import { fetchBookings } from '$lib/services/api/calendarService';

/**
 * Fetch User Details and Bookings Using `fetchBookings`
 */
export async function fetchUser(
	trainerId: number,
	fetchFn: typeof fetch
): Promise<{ user: User; bookings: FullBooking[] } | null> {
	try {
		// Fetch user details
		const userResponse = await fetchFn(`/api/users/${trainerId}`);
		if (!userResponse.ok) throw new Error('User not found');
		const userData: User = await userResponse.json();

		// Define filters for the last year
		const today = new Date();
		today.setDate(new Date().getDate() + 1);

		const lastYear = new Date();
		lastYear.setFullYear(lastYear.getFullYear() - 1);
		const toDate = today.toISOString().slice(0, 10);
		const fromDate = lastYear.toISOString().slice(0, 10);

		const bookingFilters: BookingFilters = {
			from: fromDate,
			to: toDate,
			trainerIds: [trainerId],
			personalBooking: false
		};

		const bookingsData: FullBooking[] = await fetchBookings(bookingFilters, fetchFn);

		return { user: userData, bookings: bookingsData };
	} catch (error) {
		console.error('Error fetching user:', error);
		return null;
	}
}
