import { json, type RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { notifyStandbyTimesAboutCancelledBooking } from '$lib/server/standbyTimes';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { booking_id, reason, actual_cancel_time } = await request.json();

		if (!booking_id) {
			return json({ error: 'Missing booking_id' }, { status: 400 });
		}

		const result = await query(
			`
			WITH b AS (
				SELECT
					id,
					start_time,
					status
				FROM bookings
				WHERE id = $1
				  AND status = 'New'
			),
			ctx AS (
				SELECT
					id,
					start_time AS start_local,
					COALESCE($3::timestamp, NOW()) AS cancel_local
				FROM b
			),
			decision AS (
				SELECT
					id,
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
				status = CASE WHEN d.is_late THEN 'Late_cancelled' ELSE 'Cancelled' END,
				cancel_reason = $2,
				cancel_time = NOW(),
				actual_cancel_time = COALESCE($3::timestamp, NOW()),
				updated_at = NOW()
			FROM decision d
			WHERE t.id = d.id
			RETURNING
				t.id,
				t.status,
				t.cancel_reason,
				t.cancel_time,
				t.actual_cancel_time,
				t.start_time,
				t.location_id;
			`,
			[
				booking_id,
				reason ?? null,
				actual_cancel_time ?? null // e.g. "2025-08-11T08:15"
			]
		);

		if (!result || !Array.isArray(result) || result.length === 0) {
			return json({ error: 'Booking not found or not cancelable' }, { status: 404 });
		}

		const cancelledBooking = result[0];

		try {
			await notifyStandbyTimesAboutCancelledBooking({
				startTime: cancelledBooking.start_time ?? null,
				locationId:
					cancelledBooking.location_id !== null && cancelledBooking.location_id !== undefined
						? Number(cancelledBooking.location_id)
						: null
			});
		} catch (notifyError) {
			console.error('Failed to process standby notifications after cancellation:', notifyError);
		}

		return json({ success: true, cancelled: result[0] });
	} catch (err) {
		console.error('🔥 Error cancelling booking:', err);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
