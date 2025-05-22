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
				name: bookingObject.bookingType?.label ?? 'Personal Booking',
				text: '',
				user_id: bookingObject.user_id ?? null, // First attendee as main user
				user_ids: bookingObject.attendees,
				start_time: `${bookingObject.date}T${bookingObject.time}:00`,
				end_time: `${bookingObject.date}T${parseInt(bookingObject.time) + 1}:00`, // Example: 1-hour duration
				kind: bookingObject.bookingType?.value ?? 'Corporate',
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
				booking_content_id: bookingObject.bookingType?.value ?? null,
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
		return data.availableSlots;
	}
	return [];
}
