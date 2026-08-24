import { query } from '$lib/db';
import type { RequestHandler } from '@sveltejs/kit';
import { mapBookingContentRow, type BookingContentRow } from '$lib/server/bookingContents';

export const GET: RequestHandler = async () => {
	try {
		const result = await query<BookingContentRow>(
			`SELECT id, kind, icon, active, created_at, updated_at
			 FROM booking_contents
			 WHERE active = TRUE
			 ORDER BY LOWER(kind) ASC, id ASC`
		);

		return new Response(JSON.stringify(result.map((row) => mapBookingContentRow(row))), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error fetching booking contents:', error);
		return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
	}
};
