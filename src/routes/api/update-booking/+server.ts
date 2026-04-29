import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { findUserTravelConflict } from '$lib/server/bookingTravelConflict';
import { findAvailableRoomForStart } from '$lib/server/roomBlocks';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

		const {
			booking_id,
			client_id,
			trainer_id,
			user_id,
			start_time,
			location_id,
			booking_content_id,
			status,
			room_id,
			try_out,
			internal_education,
			internal,
			education
		} = data;

		if (!booking_id) {
			console.warn('❌ Missing booking_id in request');
			return json({ error: 'Booking ID is required' }, { status: 400 });
		}

		let resolvedRoomId = room_id ?? null;
		const hasLocation = location_id !== null && location_id !== undefined;
		const hasStartTime = Boolean(start_time);

		const trainerTravelConflict = await findUserTravelConflict({
			queryFn: query,
			userId: trainer_id ?? null,
			targetStartTime: start_time ?? null,
			targetLocationId: location_id ?? null,
			ignoreBookingId: booking_id
		});
		if (trainerTravelConflict) {
			return json(
				{
					error: 'Trainer has insufficient travel time between locations.',
					conflict: trainerTravelConflict,
					conflictRole: 'trainer'
				},
				{ status: 400 }
			);
		}

		if ((internal_education || education) && user_id && user_id !== trainer_id) {
			const traineeTravelConflict = await findUserTravelConflict({
				queryFn: query,
				userId: user_id,
				targetStartTime: start_time ?? null,
				targetLocationId: location_id ?? null,
				ignoreBookingId: booking_id
			});
			if (traineeTravelConflict) {
				return json(
					{
						error: 'Selected trainee has insufficient travel time between locations.',
						conflict: traineeTravelConflict,
						conflictRole: 'trainee'
					},
					{ status: 400 }
				);
			}
		}

		if (!hasLocation) {
			resolvedRoomId = null;
		}

		if (hasLocation && hasStartTime) {
			const availability = await findAvailableRoomForStart({
				locationId: Number(location_id),
				startTime: start_time,
				ignoreBookingId: Number(booking_id),
				preferredRoomId: resolvedRoomId
			});

			if (!availability?.selectedRoomId) {
				return json({ error: 'No available room at this time.' }, { status: 400 });
			}

			resolvedRoomId = availability.selectedRoomId;
		}

		const bookingWithoutRoom = !resolvedRoomId;

		const queryParams = [
			client_id ?? null,
			trainer_id ?? null,
			user_id ?? null,
			start_time ?? null,
			location_id ?? null,
			booking_content_id ?? null,
			status ?? 'New',
			resolvedRoomId ?? null,
			try_out ?? false,
			internal_education ?? false,
			internal ?? false,
			education ?? false,
			bookingWithoutRoom,
			booking_id
		];

		const result = await query(
			`
			UPDATE bookings
			SET client_id = $1,
				trainer_id = $2,
				user_id = $3,
				start_time = $4,
				location_id = $5,
				booking_content_id = $6,
				status = $7,
				room_id = $8,
				try_out = $9,
				internal_education = $10,
				internal = $11,
				education = $12,
				booking_without_room = $13,
				updated_at = NOW()
			WHERE id = $14
			RETURNING *
			`,
			queryParams
		);

		if (!result || result.length === 0) {
			console.warn('❌ No booking updated. Booking ID may not exist.');
			return json({ error: 'Booking not found or not updated' }, { status: 404 });
		}

		return json({ success: true, booking: result[0] });
	} catch (error) {
		console.error('🔥 Error updating booking:', error);
		return json({ error: 'Failed to update booking' }, { status: 500 });
	}
};
