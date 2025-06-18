import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';

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
			requestData = {
				client_id: bookingObject.clientId ?? null,
				trainer_id: bookingObject.trainerId ?? null,
				user_id:
					bookingObject.attendees.length > 0 ? `{${bookingObject.attendees.join(',')}}` : null,
				start_time: `${bookingObject.date}T${bookingObject.time}:00`,
				location_id: bookingObject.locationId ?? null,
				booking_content_id: capitalizeFirstLetter(bookingObject.bookingType?.value ?? 'Corporate'),
				status: 'New',
				created_by_id: bookingObject.booked_by_id,
				repeat_index: bookingObject.repeat ? 1 : null
			};
		}

		// Make API request
		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestData)
		});

		const responseData = await response.json();

		if (!response.ok) throw new Error(responseData.error || 'Booking failed');

		return {
			success: true,
			message: 'Booking created successfully',
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

export async function fetchAvailableSlots({ date, trainerId, locationId, roomId }) {
	const res = await fetch('/api/available-slots', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ date, trainerId, locationId, roomId })
	});

	if (res.ok) {
		const data = await res.json();
		return {
			availableSlots: data.availableSlots,
			outsideAvailabilitySlots: data.outsideAvailabilitySlots
		};
	}

	return {
		availableSlots: [],
		outsideAvailabilitySlots: []
	};
}

export async function updateBooking(bookingObject: any) {
	try {
		const requestData = {
			booking_id: bookingObject.id,
			client_id: bookingObject.clientId ?? null,
			trainer_id: bookingObject.trainerId ?? null,
			user_id:
				bookingObject.attendees?.length > 0 ? `{${bookingObject.attendees.join(',')}}` : null,
			start_time: `${bookingObject.date}T${bookingObject.time}:00`,
			location_id: bookingObject.locationId ?? null,
			booking_content_id: bookingObject.bookingType?.value ?? null,
			status: bookingObject.status ?? 'New',
			room_id: bookingObject.roomId ?? null
		};

		const response = await fetch('/api/update-booking', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestData)
		});

		const responseData = await response.json();
		if (!response.ok) throw new Error(responseData.error || 'Update failed');

		return {
			success: true,
			message: 'Booking updated successfully',
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

export async function cancelBooking(bookingId: number, reason: string, actualCancelTime: string) {
	try {
		const res = await fetch('/api/cancel-booking', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				booking_id: bookingId,
				reason,
				actual_cancel_time: actualCancelTime
			})
		});

		const data = await res.json();

		if (!res.ok) throw new Error(data.error || 'Cancellation failed');

		return {
			success: true,
			message: 'Booking cancelled successfully',
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
