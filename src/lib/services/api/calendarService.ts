import type { FullBooking } from '$lib/types/calendarTypes';

export type BookingFilters = {
	week?: string | null;
	day?: string | null;
	roomId?: number | null;
	locationIds?: number[]; // Change from single locationId to an array
	trainerId?: number | null;
	clientId?: number | null;
};
/**
 * Fetches a list of bookings with optional filtering.
 * @param filters - Filtering options for bookings
 * @returns An array of FullBooking objects
 */
export async function fetchBookings(filters: BookingFilters): Promise<FullBooking[]> {
	const params = new URLSearchParams();

	if (filters.week) params.append('week', filters.week);
	if (filters.day) params.append('day', filters.day);
	if (filters.roomId !== null && filters.roomId !== undefined)
		params.append('roomId', filters.roomId.toString());
	if (filters.locationIds && filters.locationIds.length > 0) {
		filters.locationIds.forEach((id) => params.append('locationId', id.toString())); // Multiple IDs
	}
	if (filters.trainerId !== null && filters.trainerId !== undefined)
		params.append('trainerId', filters.trainerId.toString());
	if (filters.clientId !== null && filters.clientId !== undefined)
		params.append('clientId', filters.clientId.toString());

	try {
		const response = await fetch(`/api/bookings?${params.toString()}`);

		if (!response.ok) {
			throw new Error(`Error fetching bookings: ${response.statusText}`);
		}

		const data = await response.json();
		return data.map((b: any) => transformBooking(b)); // Transform into FullBooking structure
	} catch (error) {
		console.error('Error in fetchBookings:', error);
		return [];
	}
}

/**
 * Fetches a single booking by ID.
 * @param bookingId - The ID of the booking to fetch
 * @returns A single FullBooking object or null if not found
 */
export async function fetchBookingById(bookingId: number): Promise<FullBooking | null> {
	try {
		const response = await fetch(`/api/bookings/${bookingId}`);

		if (!response.ok) {
			throw new Error(`Error fetching booking with ID ${bookingId}: ${response.statusText}`);
		}

		const data = await response.json();
		return transformBooking(data);
	} catch (error) {
		console.error(`Error fetching booking by ID:`, error);
		return null;
	}
}

/**
 * Transforms API response into FullBooking structure.
 * @param raw - Raw booking data from API
 * @returns Formatted FullBooking object
 */
function transformBooking(raw: any): FullBooking {
	return {
		booking: {
			id: raw.id,
			status: raw.status,
			startTime: raw.start_time,
			endTime: raw.end_time ?? null,
			createdAt: raw.created_at,
			updatedAt: raw.updated_at,
			cancelTime: raw.cancel_time ?? null,
			repeatIndex: raw.repeat_index ?? null,
			tryOut: raw.try_out,
			refundComment: raw.refund_comment ?? null,
			cancelReason: raw.cancel_reason ?? null,
			bookingWithoutRoom: raw.booking_without_room,
			internalEducation: raw.internal_education
		},
		trainer: {
			id: raw.trainer_id,
			firstname: raw.trainer_firstname,
			lastname: raw.trainer_lastname
		},
		client: {
			id: raw.client_id ?? null,
			firstname: raw.client_firstname,
			lastname: raw.client_lastname
		},
		location: {
			id: raw.location_id,
			name: raw.location_name
		},
		room: {
			id: raw.room_id,
			name: raw.room_name
		},
		additionalInfo: {
			packageId: raw.package_id ?? null,
			education: raw.education,
			internal: raw.internal,
			bookingContent: {
				id: raw.booking_content_id,
				kind: raw.booking_content_kind
			},
			addedToPackageBy: raw.added_to_package_by ?? null,
			addedToPackageDate: raw.added_to_package_date ?? null,
			actualCancelTime: raw.actual_cancel_time ?? null
		}
	};
}
