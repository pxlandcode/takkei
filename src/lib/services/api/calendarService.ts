import type { FullBooking } from '$lib/types/calendarTypes';
import type { BookingFilters } from './types';

export async function fetchBookings(
	filters: BookingFilters,
	fetchFn: typeof fetch,
	limit?: number, // ✅ Now optional (unlimited if not set)
	offset: number = 0, // ✅ Default offset is 0
	fetchAllStatuses: boolean = false // ✅ Allows fetching cancelled bookings
): Promise<FullBooking[]> {
	const params = new URLSearchParams();

	// ✅ Add date filters
	if (filters.from && filters.to) {
		params.append('from', filters.from);
		params.append('to', filters.to);
	} else if (filters.date) {
		params.append('date', filters.date);
	} else {
		const today = new Date().toISOString().slice(0, 10);
		params.append('date', today);
	}

	// ✅ Add optional filters
	if (filters.roomId != null) params.append('roomId', filters.roomId.toString());
	if (filters.locationIds?.length)
		filters.locationIds.forEach((id) => params.append('locationId', id.toString()));
	if (filters.trainerIds?.length)
		filters.trainerIds.forEach((id) => params.append('trainerId', id.toString()));
	if (filters.clientIds?.length)
		filters.clientIds.forEach((id) => params.append('clientId', id.toString()));
	if (filters.userIds?.length)
		filters.userIds.forEach((id) => params.append('userId', id.toString()));

	// ✅ Apply pagination *only* if `limit` is set
	if (limit !== undefined) {
		params.append('limit', limit.toString());
		params.append('offset', offset.toString());
	}

	// ✅ Optionally include cancelled bookings
	if (fetchAllStatuses) {
		params.append('includeCancelled', 'true');
	}

	try {
		// Fetch standard bookings
		const bookingsUrl = `/api/bookings?${params.toString()}`;
		const bookingsResponse = await fetchFn(bookingsUrl);

		console.log('Bookings URL:', bookingsUrl); // Debugging line
		console.log('Bookings Response:', bookingsResponse); // Debugging line

		if (!bookingsResponse.ok) {
			const errorText = await bookingsResponse.text();
			throw new Error(`Error fetching bookings (${bookingsResponse.status}): ${errorText}`);
		}

		const standardBookings = await bookingsResponse.json();

		console.log('Standard Bookings:', standardBookings); // Debugging line

		let transformedPersonalBookings: FullBooking[] = [];
		// Fetch personal bookings with pagination
		if (filters.personalBookings) {
			const personalParams = new URLSearchParams(params);
			const personalBookingsUrl = `/api/fetch-personal-bookings?${personalParams.toString()}`;
			const personalBookingsResponse = await fetchFn(personalBookingsUrl);

			if (!personalBookingsResponse.ok) {
				const errorText = await personalBookingsResponse.text();
				throw new Error(
					`Error fetching personal bookings (${personalBookingsResponse.status}): ${errorText}`
				);
			}

			const personalBookings = await personalBookingsResponse.json();
			transformedPersonalBookings = personalBookings.map(transformPersonalBooking);
		}

		// 📌 Transform and combine both types of bookings
		const transformedStandardBookings = standardBookings.map(transformBooking);

		return [...transformedStandardBookings, ...transformedPersonalBookings];
	} catch (error) {
		console.error('Error in fetchBookings:', error);
		return [];
	}
}

/**
 * Convert API response into FullBooking format (for standard bookings).
 */
function transformBooking(raw: any): FullBooking {
	return {
		isPersonalBooking: false, // Standard booking
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
			name: raw.location_name,
			color: raw.location_color
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

/**
 * Convert API response into FullBooking format (for personal bookings).
 */
function transformPersonalBooking(raw: any): FullBooking {
	return {
		isPersonalBooking: true, // Indicates a personal booking
		booking: {
			id: raw.id,
			status: 'Confirmed', // Personal bookings don't have status; default to 'Confirmed'
			startTime: raw.start_time,
			endTime: raw.end_time ?? null,
			createdAt: raw.created_at,
			updatedAt: raw.updated_at,
			cancelTime: null,
			repeatIndex: raw.repeat_of ?? null,
			tryOut: false,
			refundComment: null,
			cancelReason: null,
			bookingWithoutRoom: false,
			internalEducation: false
		},
		trainer: null,
		client: null,
		location: null,
		room: null,
		additionalInfo: {
			packageId: null,
			education: false,
			internal: false,
			bookingContent: {
				id: null,
				kind: raw.kind
			},
			addedToPackageBy: null,
			addedToPackageDate: null,
			actualCancelTime: null
		},
		personalBooking: {
			name: raw.name,
			text: raw.text ?? '',
			bookedById: raw.booked_by_id ?? null,
			userIds: raw.user_ids ? raw.user_ids : []
		}
	};
}
