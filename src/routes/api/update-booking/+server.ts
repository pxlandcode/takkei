import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function POST({ request }) {
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

		if (!hasLocation) {
			resolvedRoomId = null;
		} else if (resolvedRoomId) {
			const validRoom = await query(
				`SELECT id FROM rooms WHERE id = $1 AND location_id = $2 AND active = true`,
				[resolvedRoomId, location_id]
			);
			if (!validRoom.length) {
				resolvedRoomId = null;
			}
		}

		if (hasLocation && hasStartTime) {
			if (resolvedRoomId) {
				const roomConflict = await query(
					`
					SELECT 1 FROM bookings
					WHERE room_id = $1
					  AND start_time = $2
					  AND id <> $3
					  AND (status IS NULL OR LOWER(status) NOT IN ('cancelled', 'late_cancelled'))
					LIMIT 1
				`,
					[resolvedRoomId, start_time, booking_id]
				);
				if (roomConflict.length) {
					resolvedRoomId = null;
				}
			}

			if (!resolvedRoomId) {
				const availableRooms = await query(
					`
					SELECT r.id FROM rooms r
					WHERE r.location_id = $1
					  AND r.active = true
					  AND NOT EXISTS (
						SELECT 1 FROM bookings b
						WHERE b.room_id = r.id
						  AND b.start_time = $2
						  AND b.id <> $3
						  AND (b.status IS NULL OR LOWER(b.status) NOT IN ('cancelled', 'late_cancelled'))
					  )
					ORDER BY r.id ASC
					LIMIT 1
				`,
					[location_id, start_time, booking_id]
				);

				if (!availableRooms.length) {
					return json({ error: 'No available room at this time.' }, { status: 400 });
				}

				resolvedRoomId = availableRooms[0].id;
			}
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
}
