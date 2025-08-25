import { query } from '$lib/db';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

		// Extract booking details from request
		const {
			client_id = null,
			package_id = null,
			room_id = null,
			trainer_id = null,
			status = 'New',
			start_time = new Date().toISOString(),
			location_id = null,
			created_by_id = null,
			booking_content_id = null,
			refund_comment = null,
			repeat_index = null,
			try_out = false,
			cancel_reason = null,
			cancel_time = null,
			added_to_package_date = null,
			education = false,
			internal = false,
			user_id = null,
			added_to_package_by = null,
			booking_without_room = false,
			location_name = null,
			actual_cancel_time = null,
			internal_education = false
		} = data;

		if (internal_education) {
			if (!user_id) {
				return new Response(JSON.stringify({ error: 'user_id is required for Praktiktimme' }), {
					status: 422
				});
			}
			client_id = null;
			try_out = false;
		}

		// 🔍 Auto-select room if not provided
		let selectedRoomId = room_id;

		if (!selectedRoomId && location_id && start_time) {
			const availableRooms = await query(
				`
				SELECT r.id FROM rooms r
				WHERE r.location_id = $1
				AND r.active = true
				AND NOT EXISTS (
					SELECT 1 FROM bookings b
					WHERE b.room_id = r.id
					AND b.start_time = $2
				)
				ORDER BY r.id ASC
				LIMIT 1
			`,
				[location_id, start_time]
			);

			if (availableRooms.length === 0) {
				return new Response(JSON.stringify({ error: 'No available room at this time.' }), {
					status: 400
				});
			}

			selectedRoomId = availableRooms[0].id;
		}

		const result = await query(
			`
			INSERT INTO bookings 
				(client_id, package_id, room_id, trainer_id, status, start_time, location_id, created_by_id, booking_content_id, refund_comment, repeat_index, try_out, cancel_reason, cancel_time, added_to_package_date, education, internal, user_id, added_to_package_by, booking_without_room, location_name, actual_cancel_time, internal_education, created_at, updated_at)
			VALUES
				($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW(), NOW())
			RETURNING id
			`,
			[
				client_id,
				package_id,
				selectedRoomId,
				trainer_id,
				status,
				start_time,
				location_id,
				created_by_id,
				booking_content_id,
				refund_comment,
				repeat_index,
				try_out,
				cancel_reason,
				cancel_time,
				added_to_package_date,
				education,
				internal,
				user_id,
				added_to_package_by,
				!selectedRoomId,
				location_name,
				actual_cancel_time,
				internal_education
			]
		);

		const bookingId = result[0].id;

		return new Response(JSON.stringify({ message: 'Booking created successfully', bookingId }), {
			status: 201
		});
	} catch (error) {
		console.error('Error creating booking:', error);
		return new Response(JSON.stringify({ error: (error as Error).message }), {
			status: 500
		});
	}
};
