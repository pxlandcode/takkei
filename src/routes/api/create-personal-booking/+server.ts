import { query } from '$lib/db';
import { findConflictingUsersForTimeRange } from '$lib/server/meetingBusyHelper';
import type { RequestHandler } from '@sveltejs/kit';

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

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

		console.log('📝 create-personal-booking POST received');
		console.log('  start_time:', data.start_time);
		console.log('  end_time:', data.end_time);
		console.log('  user_id:', data.user_id);
		console.log('  user_ids:', data.user_ids);

		// Extract personal booking details
		const name = data.name ?? null;
		const text = data.text ?? null;
		const user_id = data.user_id ?? null;
		const user_ids = data.user_ids?.length > 0 ? data.user_ids : null;
		const start_time = data.start_time ?? new Date().toISOString();
		const end_time = data.end_time ?? new Date().toISOString();
		const kind = data.kind ?? 'Personal';
		const repeat_of = data.repeat_of ?? null;
		const booked_by_id = data.booked_by_id ?? null;

		const userIds = collectUserIds(user_id, user_ids);
		console.log('  Collected userIds:', userIds);

		if (userIds.length > 0) {
			console.log('  Checking for conflicts...');

		// Fix timezone issue: remove 'Z' from timestamps to prevent UTC conversion
		const fixedStartTime = start_time.replace('Z', '');
		const fixedEndTime = end_time.replace('Z', '');
		console.log('  Fixed start_time:', fixedStartTime);
		console.log('  Fixed end_time:', fixedEndTime);

		const conflictingUserIds = await findConflictingUsersForTimeRange({
			startTime: fixedStartTime,
			endTime: fixedEndTime,
			userIds
		});

		console.log('  Conflict check result:', conflictingUserIds);

				console.log('  ❌ Conflicts found:', conflictingUserIds);
				return new Response(
					JSON.stringify({
						error: 'Booking overlaps with existing bookings.',
						conflictingUserIds
					}),
					{ status: 409 }
				);
			}
			console.log('  ✅ No conflicts found');
		}

		// Insert personal booking into the database
		const result = await query(
			`
      INSERT INTO personal_bookings 
        (name, text, user_id, start_time, end_time, kind, repeat_of, booked_by_id, user_ids, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9::int[], NOW(), NOW())
      RETURNING id
      `,
			[name, text, user_id, start_time, end_time, kind, repeat_of, booked_by_id, user_ids]
		);

		const bookingId = result[0].id;
		console.log('  ✅ Booking created with ID:', bookingId);

		return new Response(
			JSON.stringify({ message: 'Personal booking created successfully', bookingId }),
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error creating personal booking:', error);
		return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
	}
};
