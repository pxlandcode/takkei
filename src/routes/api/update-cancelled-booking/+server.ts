import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import { CANCELLED_STATUS, LATE_CANCELLED_STATUS } from '$lib/helpers/bookingHelpers/cancellation';

export async function POST({ request }) {
	try {
		const { booking_id, reason, actual_cancel_time } = await request.json();

		if (!booking_id) {
			return json({ error: 'Missing booking_id' }, { status: 400 });
		}

		if (!reason) {
			return json({ error: 'Missing reason' }, { status: 400 });
		}

		if (!actual_cancel_time) {
			return json({ error: 'Missing actual_cancel_time' }, { status: 400 });
		}

		const result = await query(
			`
			WITH b AS (
				SELECT
					id,
					start_time,
					actual_cancel_time,
					cancel_time
				FROM bookings
				WHERE id = $1
				  AND status IN ('${CANCELLED_STATUS}', '${LATE_CANCELLED_STATUS}')
			),
			ctx AS (
				SELECT
					id,
					start_time AS start_local,
					COALESCE($3::timestamp, actual_cancel_time, cancel_time, NOW()) AS cancel_local
				FROM b
			),
			decision AS (
				SELECT
					id,
					cancel_local,
					CASE
						WHEN date_trunc('day', start_local) > cancel_local + INTERVAL '24 hours'
						  OR (
							start_local::date = (cancel_local + INTERVAL '1 day')::date
							AND EXTRACT(HOUR FROM cancel_local) < 12
						  )
						THEN false
						ELSE true
					END AS is_late
				FROM ctx
			)
			UPDATE bookings t
			SET
				status = CASE WHEN d.is_late THEN '${LATE_CANCELLED_STATUS}' ELSE '${CANCELLED_STATUS}' END,
				cancel_reason = $2,
				actual_cancel_time = d.cancel_local,
				updated_at = NOW()
			FROM decision d
			WHERE t.id = d.id
			RETURNING t.id, t.status, t.cancel_reason, t.cancel_time, t.actual_cancel_time, t.updated_at;
			`,
			[booking_id, reason, actual_cancel_time]
		);

		if (!result || !Array.isArray(result) || result.length === 0) {
			return json({ error: 'Booking not found or not editable' }, { status: 404 });
		}

		return json({ success: true, booking: result[0] });
	} catch (err) {
		console.error('Error updating cancelled booking:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
