import { query } from '$lib/db';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

		// Extract booking details from request
		const client_id = data.client_id ?? null;
		const package_id = data.package_id ?? null;
		const room_id = data.room_id ?? null;
		const trainer_id = data.trainer_id ?? null;
		const status = data.status ?? 'New';
		const start_time = data.start_time ?? new Date().toISOString();
		const location_id = data.location_id ?? null;
		const created_by_id = data.created_by_id ?? null;
		const booking_content_id = data.booking_content_id ?? null;

		// Optional fields
		const refund_comment = data.refund_comment ?? null;
		const repeat_index = data.repeat_index ?? null;
		const try_out = data.try_out ?? false;
		const cancel_reason = data.cancel_reason ?? null;
		const cancel_time = data.cancel_time ?? null;
		const added_to_package_date = data.added_to_package_date ?? null;
		const education = data.education ?? false;
		const internal = data.internal ?? false;
		const user_id = data.user_id ?? null;
		const added_to_package_by = data.added_to_package_by ?? null;
		const booking_without_room = data.booking_without_room ?? false;
		const location_name = data.location_name ?? null;
		const actual_cancel_time = data.actual_cancel_time ?? null;
		const internal_education = data.internal_education ?? false;

		// Insert booking into the database
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
				room_id,
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
				booking_without_room,
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
