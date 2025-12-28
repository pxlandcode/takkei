import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
import { invalidateByPrefix } from '$lib/services/api/apiCache';

const BOOKINGS_PREFIX = '/api/bookings';
const PERSONAL_BOOKINGS_PREFIX = '/api/fetch-personal-bookings';
const NOTIFICATIONS_PREFIX = '/api/notifications';

function invalidateBookingRelatedCaches() {
	invalidateByPrefix(BOOKINGS_PREFIX);
	invalidateByPrefix(PERSONAL_BOOKINGS_PREFIX);
	invalidateByPrefix(NOTIFICATIONS_PREFIX);
}

async function notify(data) {
	await fetch('/api/notifications', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(data)
	});
}

export async function createBooking(
	bookingObject: any,
	type: 'training' | 'personal' | 'meeting' = 'training'
) {
	try {
		// Determine which API to call
		let apiUrl =
			type === 'personal' || type === 'meeting'
				? '/api/create-personal-booking'
				: '/api/create-booking';

		let requestData;

		if (type === 'personal' || type === 'meeting') {
			requestData = {
				name: bookingObject.name ?? 'Personal Booking',
				text: bookingObject.text ?? '',
				user_id: bookingObject.user_id ?? null,
				user_ids: bookingObject.attendees,
				start_time: `${bookingObject.date}T${bookingObject.time}:00`,
				end_time: `${bookingObject.date}T${bookingObject.endTime}:00`,
				kind: capitalizeFirstLetter(bookingObject.bookingType?.value ?? 'Corporate'),
				repeat_of: bookingObject.repeat ? 1 : null,
				booked_by_id: bookingObject.booked_by_id
			};
		} else {
			const includeUserId = !!bookingObject.internalEducation || !!bookingObject.education;
			const resolvedUserIdRaw =
				bookingObject.user_id ??
				(Array.isArray(bookingObject.attendees) && bookingObject.attendees.length > 0
					? bookingObject.attendees[0]
					: null);
			const resolvedUserId =
				resolvedUserIdRaw !== null && resolvedUserIdRaw !== undefined
					? Number(resolvedUserIdRaw)
					: null;

			// For practice (internalEducation), education, and flight (internal) bookings,
			// booking_content_id should be null since they don't use booking_contents table
			const isSpecialBooking =
				!!bookingObject.internalEducation || !!bookingObject.education || !!bookingObject.internal;
			const bookingContentId = isSpecialBooking ? null : (bookingObject.bookingType?.value ?? null);

			requestData = {
				client_id: bookingObject.clientId ?? null,
				package_id: bookingObject.packageId ?? null,
				trainer_id: bookingObject.trainerId ?? null,
				start_time: `${bookingObject.date}T${bookingObject.time}:00`,
				location_id: bookingObject.locationId ?? null,
				booking_content_id: bookingContentId,
				status: 'New',
				try_out: !!bookingObject.isTrial,
				internal_education: !!bookingObject.internalEducation, //praktiktimme
				education: !!bookingObject.education, //utbildningstimme
				internal: !!bookingObject.internal, //flygtimme
				created_by_id: bookingObject.booked_by_id,
				repeat_index: bookingObject.repeat ? 1 : null
			};

			if (includeUserId) {
				const canAssignUserId =
					typeof resolvedUserId === 'number' && Number.isFinite(resolvedUserId);
				requestData.user_id = canAssignUserId ? resolvedUserId : null;
			}
		}

		// Make API request
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestData)
		});

		const responseData = await response.json();
		const currentUser = bookingObject.currentUser;
		if (response.ok) {
			// ✅ Notify for personal booking created by someone else
			if (type === 'personal' && bookingObject.user_id !== currentUser.id) {
				await notify({
					name: 'Personlig bokning skapad',
					description: `En personlig bokning har lagts till i ditt schema av ${currentUser.firstname} ${currentUser.lastname}.`,
					user_ids: [bookingObject.user_id],
					start_time: requestData.start_time,
					end_time: requestData.end_time ?? null,
					created_by: currentUser.id
				});
			}

			// ✅ Notify for meeting with multiple attendees
			if (type === 'meeting' && bookingObject.user_ids?.length > 0) {
				await notify({
					name: 'Nytt möte inbokat',
					description: `Ett nytt möte har lagts till i ditt schema av ${currentUser.firstname} ${currentUser.lastname}.`,
					user_ids: bookingObject.user_ids,
					start_time: requestData.start_time,
					end_time: requestData.end_time ?? null,
					created_by: currentUser.id
				});
			}

			// ✅ Notify trainer for a client booking if not created by them
			if (
				type === 'training' &&
				bookingObject.trainerId &&
				bookingObject.trainerId !== currentUser.id
			) {
				await notify({
					name: 'Ny klientbokning',
					description: `En klientbokning har lagts till i ditt schema av ${currentUser.firstname} ${currentUser.lastname}.`,
					user_ids: [bookingObject.trainerId],
					start_time: requestData.start_time,
					end_time: null,
					created_by: currentUser.id
				});
			}
		} else {
			throw new Error(responseData.error || 'Booking creation failed');
		}
		invalidateBookingRelatedCaches();
		return {
			success: true,
			message: 'Bokningen har skapats',
			bookingId: responseData.bookingId
		};
	} catch (error) {
		console.error('Error Submitting Booking:', error);

		return {
			success: false,
			message: 'Error creating booking',
			error: error.message
		};
	}
}
export async function fetchAvailableSlots({
	date,
	trainerId,
	locationId,
	checkUsersBusy,
	userId,
	ignoreBookingId
}: {
	date: string;
	trainerId: number;
	locationId: number;
	checkUsersBusy?: boolean;
	userId?: number | null;
	ignoreBookingId?: number | null;
}) {
	const body: any = { date, trainerId, locationId };
	if (checkUsersBusy) {
		body.checkUsersBusy = true;
		body.userId = userId ?? null;
	}
	if (typeof ignoreBookingId === 'number' && Number.isFinite(ignoreBookingId)) {
		body.ignoreBookingId = ignoreBookingId;
	}
	const res = await fetch('/api/available-slots', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (res.ok) {
		const data = await res.json();
		return {
			availableSlots: data.availableSlots,
			outsideAvailabilitySlots: data.outsideAvailabilitySlots
		};
	}
	return { availableSlots: [], outsideAvailabilitySlots: [] };
}

export async function updateStandardBooking(bookingObject: any) {
	try {
		const includeUserId = !!bookingObject.internalEducation || !!bookingObject.education;

		const requestData: Record<string, any> = {
			booking_id: bookingObject.id,
			client_id: bookingObject.clientId ?? null,
			trainer_id: bookingObject.trainerId ?? null,
			start_time: `${bookingObject.date}T${bookingObject.time}:00`,
			location_id: bookingObject.locationId ?? null,
			booking_content_id: bookingObject.bookingType?.value ?? null,
			status: bookingObject.status ?? 'New',
			room_id: bookingObject.roomId ?? null,
			try_out: !!bookingObject.isTrial,
			internal_education: !!bookingObject.internalEducation,
			internal: !!bookingObject.internal,
			education: !!bookingObject.education
		};

		if (includeUserId) {
			const rawUserId = bookingObject.user_id;
			const normalizedUserId =
				rawUserId !== null && rawUserId !== undefined ? Number(rawUserId) : null;
			const canAssignUserId =
				typeof normalizedUserId === 'number' && Number.isFinite(normalizedUserId);
			requestData.user_id = canAssignUserId ? normalizedUserId : null;
		}

		const response = await fetch('/api/update-booking', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestData)
		});

		const responseData = await response.json();
		if (!response.ok) throw new Error(responseData.error || 'Update failed');

		invalidateBookingRelatedCaches();
		return {
			success: true,
			message: 'Bokningen har uppdaterats',
			booking: responseData.booking
		};
	} catch (error) {
		console.error('Error Updating Booking:', error);
		return {
			success: false,
			message: 'Error updating booking',
			error: error.message
		};
	}
}

export async function updatePersonalBooking(bookingObject: any, kind: string) {
	try {
		const userIds = bookingObject.user_ids ?? bookingObject.attendees ?? [];

		const requestData = {
			booking_id: bookingObject.id,
			name: bookingObject.name ?? null,
			text: bookingObject.text ?? null,
			user_id: bookingObject.user_id ?? null,
			user_ids: userIds.length ? userIds : null,
			start_time: `${bookingObject.date}T${bookingObject.time}:00`,
			end_time: bookingObject.endTime ? `${bookingObject.date}T${bookingObject.endTime}:00` : null,
			kind: kind
		};

		const response = await fetch('/api/update-personal-booking', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestData)
		});

		const responseData = await response.json();
		if (!response.ok) throw new Error(responseData.error || 'Update failed');

		invalidateBookingRelatedCaches();
		return {
			success: true,
			message: 'Bokningen har uppdaterats',
			booking: responseData.booking
		};
	} catch (error) {
		console.error('Error Updating Personal Booking:', error);
		return {
			success: false,
			message: 'Error updating personal booking',
			error: error.message
		};
	}
}

export async function cancelBooking(
	bookingId: number,
	reason: string,
	actualCancelTime: string | undefined
) {
	try {
		const res = await fetch('/api/cancel-booking', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				booking_id: bookingId,
				reason,
				actual_cancel_time: actualCancelTime ?? null
			})
		});

		const data = await res.json();

		if (!res.ok) throw new Error(data.error || 'Cancellation failed');

		invalidateBookingRelatedCaches();
		return {
			success: true,
			message: 'Bokningen har avbokats',
			data: data.cancelled
		};
	} catch (err) {
		console.error('Error cancelling booking:', err);
		return {
			success: false,
			message: err.message ?? 'Unknown cancellation error'
		};
	}
}

export async function deletePersonalBooking(bookingId: number) {
	try {
		const res = await fetch(`/api/personal-bookings/${bookingId}`, {
			method: 'DELETE'
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || 'Kunde inte ta bort personlig bokning');
		invalidateBookingRelatedCaches();
		return {
			success: true,
			message: 'Bokningen har tagits bort',
			data
		};
	} catch (error: any) {
		console.error('Error deleting personal booking:', error);
		return {
			success: false,
			message: error?.message ?? 'Unknown deletion error'
		};
	}
}

export async function deleteMeetingBooking(bookingId: number) {
	try {
		const res = await fetch(`/api/bookings/${bookingId}`, {
			method: 'DELETE'
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || 'Kunde inte ta bort mötet');
		invalidateBookingRelatedCaches();
		return {
			success: true,
			message: 'Bokningen har tagits bort',
			data
		};
	} catch (error: any) {
		console.error('Error deleting meeting booking:', error);
		return {
			success: false,
			message: error?.message ?? 'Unknown deletion error'
		};
	}
}
