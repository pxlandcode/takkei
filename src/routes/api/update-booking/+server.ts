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
			end_time,
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

		const queryParams = [
			client_id ?? null,
			trainer_id ?? null,
			user_id ?? null,
			start_time ?? null,
			end_time ?? null,
			location_id ?? null,
			booking_content_id ?? null,
			status ?? 'New',
			room_id ?? null,
			try_out ?? false,
			internal_education ?? false,
			internal ?? false,
			education ?? false,
			booking_id
		];

		const result = await query(
			`
			UPDATE bookings
			SET client_id = $1,
				trainer_id = $2,
				user_id = $3,
				start_time = $4,
				end_time = $5,
				location_id = $6,
				booking_content_id = $7,
				status = $8,
				room_id = $9,
				try_out = $10,
				internal_education = $11,
				internal = $12,
				education = $13,
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
