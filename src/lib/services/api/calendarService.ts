import type { FullBooking } from '$lib/types/calendarTypes';
import type { BookingFilters } from './types';

export async function fetchBookings(
	filters: BookingFilters,
	fetchFn: typeof fetch
): Promise<FullBooking[]> {
	const params = new URLSearchParams();

	// ✅ Add date filters
	if (filters.from && filters.to) {
		params.append('from', filters.from);
		params.append('to', filters.to);
	} else if (filters.date) {
		params.append('date', filters.date);
	} else {
		// ✅ Default to today's date
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

	try {
		const url = `/api/bookings?${params.toString()}`;
		console.log('Fetching bookings:', url);
		const response = await fetchFn(url);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Error fetching bookings (${response.status}): ${errorText}`);
		}

		const data = await response.json();
		return data.map(transformBooking);
	} catch (error) {
		console.error('Error in fetchBookings:', error);
		return [];
	}
}

/**
 * Convert API response into FullBooking format.
 * @param raw - Raw booking data from API.
 * @returns Formatted FullBooking object.
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
