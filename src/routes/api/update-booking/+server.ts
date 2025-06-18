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
			room_id
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
			location_id ?? null,
			booking_content_id ?? null,
			status ?? 'New',
			room_id ?? null,
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
				updated_at = NOW()
			WHERE id = $9
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
