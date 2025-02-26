export async function createBooking(bookingObject: any) {
	try {
		// Determine which API to call
		let apiUrl =
			bookingObject.bookingType?.value === 'personal'
				? '/api/create-personal-booking'
				: '/api/create-booking';

		let requestData;

		if (
			bookingObject.bookingType?.value === 'personal' ||
			bookingObject.bookingType?.value === 'meeting'
		) {
			requestData = {
				name: bookingObject.bookingType?.label ?? 'Personal Booking',
				text: '',
				user_id: bookingObject.attendees[0] ?? null, // First attendee as main user
				user_ids: bookingObject.attendees,
				start_time: `${bookingObject.date}T${bookingObject.time}:00`,
				end_time: `${bookingObject.date}T${parseInt(bookingObject.time) + 1}:00`, // Example: 1-hour duration
				kind: bookingObject.bookingType?.value ?? 'Corporate',
				repeat_of: bookingObject.repeat ? 1 : null,
				booked_by_id: 1 // Replace with actual user ID
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
				created_by_id: 1, // Replace with actual user ID
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
