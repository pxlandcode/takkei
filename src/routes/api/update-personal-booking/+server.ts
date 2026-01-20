import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import { findConflictingUsersForTimeRange } from '$lib/server/meetingBusyHelper';

function collectUserIds(primaryId: unknown, list: unknown): number[] {
	const ids = new Set<number>();
	const add = (value: unknown) => {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) ids.add(parsed);
	};

	add(primaryId);
	if (Array.isArray(list)) {
		list.forEach(add);
	}

	return Array.from(ids);
}

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

		const bookingIdNumber = Number(booking_id);
		const userIds = collectUserIds(user_id, user_ids);
		if (userIds.length > 0 && start_time && end_time) {
			const conflictingUserIds = await findConflictingUsersForTimeRange({
				startTime: start_time,
				endTime: end_time,
				userIds,
				ignorePersonalBookingId: Number.isFinite(bookingIdNumber) ? bookingIdNumber : undefined
			});
			if (conflictingUserIds === null) {
				return json({ error: 'Invalid time range.' }, { status: 422 });
			}
			if (conflictingUserIds.length > 0) {
				return json(
					{
						error: 'Booking overlaps with existing bookings.',
						conflictingUserIds
					},
					{ status: 409 }
				);
			}
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
