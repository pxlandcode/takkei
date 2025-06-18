import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function POST({ request }) {
	try {
		const { booking_id, reason, actual_cancel_time } = await request.json();

		if (!booking_id || !reason || !actual_cancel_time) {
			console.warn('❌ Missing required fields in cancel request');
			return json({ error: 'Missing booking ID, reason or actual_cancel_time' }, { status: 400 });
		}

		const result = await query(
			`
			UPDATE bookings
			SET status = 'Cancelled',
				cancel_reason = $1,
				cancel_time = NOW(),
				actual_cancel_time = $2,
				updated_at = NOW()
			WHERE id = $3
			RETURNING id, status, cancel_reason, cancel_time, actual_cancel_time
			`,
			[reason, actual_cancel_time, booking_id]
		);

		if (!result || !Array.isArray(result) || result.length === 0) {
			console.warn('❌ Booking not found or not cancelled');
			return json({ error: 'Booking not found or not cancelled' }, { status: 404 });
		}

		return json({ success: true, cancelled: result[0] });
	} catch (err) {
		console.error('🔥 Error cancelling booking:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
