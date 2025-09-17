import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function POST({ request }) {
	try {
		const data = await request.json();

		const {
			booking_id,
			name,
			text,
			user_id,
			user_ids,
			start_time,
			end_time,
			kind
		} = data;

		if (!booking_id) {
			return json({ error: 'Booking ID is required' }, { status: 400 });
		}

		const result = await query(
			`
			UPDATE personal_bookings
			SET name = $1,
				text = $2,
				user_id = $3,
				user_ids = $4::int[],
				start_time = $5,
				end_time = $6,
				kind = $7,
				updated_at = NOW()
			WHERE id = $8
			RETURNING *
			`,
			[
				name ?? null,
				text ?? null,
				user_id ?? null,
				user_ids?.length ? user_ids : null,
				start_time ?? null,
				end_time ?? null,
				kind ?? null,
				booking_id
			]
		);

		if (!result || result.length === 0) {
			return json({ error: 'Booking not found or not updated' }, { status: 404 });
		}

		return json({ success: true, booking: result[0] });
	} catch (error) {
		console.error('Error updating personal booking:', error);
		return json({ error: 'Failed to update personal booking' }, { status: 500 });
	}
}
