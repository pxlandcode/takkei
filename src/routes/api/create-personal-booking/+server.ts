import { query } from '$lib/db';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();

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

		return new Response(
			JSON.stringify({ message: 'Personal booking created successfully', bookingId }),
			{ status: 201 }
		);
	} catch (error) {
		console.error('Error creating personal booking:', error);
		return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
	}
};
