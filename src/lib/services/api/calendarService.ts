import type { FullBooking, BookingFilters } from '$lib/types/calendarTypes';

import { wrapFetch } from '$lib/services/api/apiCache';

export type AvailabilitySlot = {
	from: string;
	to: string;
};

export type UserAvailabilityMap = Record<string, AvailabilitySlot[] | null>;
export type UserBlockedDayReason = 'absence' | 'vacation';
export type UserBlockedDaysMap = Record<string, UserBlockedDayReason>;
export type UserAvailabilityResponse = {
	success: boolean;
	availability: UserAvailabilityMap;
	blockedDays: UserBlockedDaysMap;
};

export type UsersAvailabilityResponse = {
	success: boolean;
	availability: Record<number, UserAvailabilityMap>;
	blockedDays: Record<number, UserBlockedDaysMap>;
};

function collectPersonalBookingUserIds(raw: any): number[] {
	const ids = new Set<number>();
	const add = (value: unknown) => {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) ids.add(parsed);
	};

	add(raw.user_id);
	if (Array.isArray(raw.user_ids)) {
		raw.user_ids.forEach(add);
	}

	return Array.from(ids);
}

export function buildBookingUrls(
	filters: BookingFilters,
	limit?: number,
	offset: number = 0,
	fetchAllStatuses: boolean = false
): {
	standardUrl: string;
	personalUrl?: string;
	sortAscending: boolean;
} {
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

	const standardUrl = `/api/bookings?${params.toString()}`;
	const personalParams = new URLSearchParams(params);
	const personalUrl = filters.personalBookings
		? `/api/fetch-personal-bookings?${personalParams.toString()}`
		: undefined;
	const sortAscending = filters.sortAsc === true;
	return { standardUrl, personalUrl, sortAscending };
}

export async function fetchBookings(
	filters: BookingFilters,
	fetchFn: typeof fetch,
	limit?: number,
	offset: number = 0,
	fetchAllStatuses: boolean = false
): Promise<FullBooking[]> {
	const cachedFetch = wrapFetch(fetchFn);
	const { standardUrl, personalUrl, sortAscending } = buildBookingUrls(
		filters,
		limit,
		offset,
		fetchAllStatuses
	);

	try {
		// Fetch standard bookings
		const bookingsResponse = await cachedFetch(standardUrl);

		if (!bookingsResponse.ok) {
			const errorText = await bookingsResponse.text();
			throw new Error(`Error fetching bookings (${bookingsResponse.status}): ${errorText}`);
		}

		const standardBookings = await bookingsResponse.json();

		let transformedPersonalBookings: FullBooking[] = [];
		// Fetch personal bookings with pagination
		if (filters.personalBookings && personalUrl) {
			const personalBookingsResponse = await cachedFetch(personalUrl);

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
export function transformBooking(raw: any): FullBooking {
	const tryOut = Boolean(raw.try_out);
	const internalEducation = Boolean(raw.internal_education);
	const education = Boolean(raw.education);
	const internal = Boolean(raw.internal);
	const linkedNoteCount =
		typeof raw.linked_note_count === 'number'
			? raw.linked_note_count
			: raw.linked_note_count != null
				? Number(raw.linked_note_count)
				: undefined;

	const trainee =
		raw.trainee_id != null
			? {
					id: raw.trainee_id,
					firstname: raw.trainee_firstname ?? '',
					lastname: raw.trainee_lastname ?? '',
					active: raw.trainee_active == null ? undefined : Boolean(raw.trainee_active)
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
			createdById: raw.created_by_id ?? null,
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
			lastname: raw.client_lastname,
			active: raw.client_active == null ? undefined : Boolean(raw.client_active)
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
		},
		linkedNoteCount
	};
}

export async function fetchBookingById(
	bookingId: number,
	fetchFn: typeof fetch
): Promise<FullBooking | null> {
	try {
		const cachedFetch = wrapFetch(fetchFn);
		const res = await cachedFetch(`/api/bookings/${bookingId}`);
		if (!res.ok) {
			return null;
		}
		const raw = await res.json();
		if (!raw) return null;
		return transformBooking(raw);
	} catch (error) {
		console.error('Error fetching booking by id:', error);
		return null;
	}
}

/**
 * Convert API response into FullBooking format (for personal bookings).
 */
export function transformPersonalBooking(raw: any): FullBooking {
	const userIds = collectPersonalBookingUserIds(raw);

	return {
		isPersonalBooking: true, // Indicates a personal booking
		booking: {
			id: raw.id,
			status: 'Confirmed', // Personal bookings don't have status; default to 'Confirmed'
			startTime: raw.start_time,
			endTime: raw.end_time ?? null,
			createdAt: raw.created_at,
			createdById: null,
			updatedAt: raw.updated_at,
			cancelTime: null,
			repeatIndex: raw.repeat_of ?? null,
			tryOut: false,
			refundComment: null,
			cancelReason: null,
			bookingWithoutRoom: false,
			internalEducation: false,
			userId: raw.user_id ?? null
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
				id: 0,
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
			userIds,
			kind: raw.kind ?? 'Private'
		}
	};
}

export async function fetchUsersAvailability(
	userIds: number[],
	from: string,
	to: string,
	fetchFn: typeof fetch = fetch
): Promise<UsersAvailabilityResponse> {
	const params = new URLSearchParams({ from, to });
	for (const userId of userIds) {
		if (!Number.isFinite(userId)) continue;
		params.append('userId', String(userId));
	}

	const res = await fetchFn(`/api/availability/users-availability?${params.toString()}`);
	if (!res.ok) throw new Error('Kunde inte hämta tillgänglighet');
	return await res.json();
}

export async function fetchUserAvailability(
	userId: number,
	from: string,
	to: string,
	fetchFn: typeof fetch = fetch
): Promise<UserAvailabilityResponse> {
	const response = await fetchUsersAvailability([userId], from, to, fetchFn);
	return {
		success: response.success,
		availability: response.availability[userId] ?? {},
		blockedDays: response.blockedDays[userId] ?? {}
	};
}
