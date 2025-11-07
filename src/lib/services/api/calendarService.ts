import type { FullBooking, BookingFilters } from '$lib/types/calendarTypes';

export async function fetchBookings(
	filters: BookingFilters,
	fetchFn: typeof fetch,
	limit?: number,
	offset: number = 0,
	fetchAllStatuses: boolean = false
): Promise<FullBooking[]> {
	const params = new URLSearchParams();

	// ✅ Add date filters
	if (filters.forwardOnly && filters.from) {
		params.append('from', filters.from);
	} else if (filters.from && filters.to) {
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

	// boolean to decide if asc or desc
	if (filters.sortAsc) {
		params.append('sort', 'asc');
	} else {
		params.append('sort', 'desc'); // default for legacy support
	}

	// ✅ Optionally include cancelled bookings
	if (fetchAllStatuses) {
		params.append('includeCancelled', 'true');
	}

	try {
		// Fetch standard bookings
		const bookingsUrl = `/api/bookings?${params.toString()}`;
		const bookingsResponse = await fetchFn(bookingsUrl);

		if (!bookingsResponse.ok) {
			const errorText = await bookingsResponse.text();
			throw new Error(`Error fetching bookings (${bookingsResponse.status}): ${errorText}`);
		}

		const standardBookings = await bookingsResponse.json();

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
		const combinedBookings = [...transformedStandardBookings, ...transformedPersonalBookings];
		const sortAscending = filters.sortAsc === true;
		combinedBookings.sort((a, b) => {
			const aTime = new Date(a.booking.startTime).getTime();
			const bTime = new Date(b.booking.startTime).getTime();
			if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
				return 0;
			}
			return sortAscending ? aTime - bTime : bTime - aTime;
		});

		return combinedBookings;
	} catch (error) {
		console.error('Error in fetchBookings:', error);
		return [];
	}
}

/**
 * Convert API response into FullBooking format (for standard bookings).
 */
function transformBooking(raw: any): FullBooking {
	const tryOut = Boolean(raw.try_out);
	const internalEducation = Boolean(raw.internal_education);
	const education = Boolean(raw.education);
	const internal = Boolean(raw.internal);

	const trainee =
		raw.trainee_id != null
			? {
					id: raw.trainee_id,
					firstname: raw.trainee_firstname ?? '',
					lastname: raw.trainee_lastname ?? ''
				}
			: null;

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
			actualCancelTime: raw.actual_cancel_time ?? null,
			repeatIndex: raw.repeat_index ?? null,
			tryOut,
			refundComment: raw.refund_comment ?? null,
			cancelReason: raw.cancel_reason ?? null,
			bookingWithoutRoom: raw.booking_without_room,
			internalEducation,
			userId: raw.user_id ?? null
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
		trainee,
		additionalInfo: {
			packageId: raw.package_id ?? null,
			education,
			internal,
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
			userIds: raw.user_ids ? raw.user_ids : [],
			kind: raw.kind ?? 'Private'
		}
	};
}

export async function fetchUserAvailability(
	userId: number,
	from: string,
	to: string,
	fetchFn: typeof fetch = fetch
) {
	const res = await fetchFn(
		`/api/availability/users-availability?userId=${userId}&from=${from}&to=${to}`
	);
	if (!res.ok) throw new Error('Kunde inte hämta tillgänglighet');
	return await res.json();
}
