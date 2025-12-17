import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';

export const GET: RequestHandler = async ({ params }) => {
	const bookingId = Number(params.id);

	if (!bookingId || Number.isNaN(bookingId)) {
		return json({ error: 'Ogiltigt boknings-ID' }, { status: 400 });
	}

	try {
		const result = await query(
			`
        SELECT
          n.*,
          nk.title AS note_kind_title,
          bn.booking_id AS linked_booking_id
        FROM booking_notes bn
        JOIN notes n ON n.id = bn.note_id
        LEFT JOIN note_kinds nk ON nk.id = n.note_kind_id
        WHERE bn.booking_id = $1
        ORDER BY n.created_at DESC
      `,
			[bookingId]
		);

		return json(result, { status: 200 });
	} catch (error) {
		console.error('Error fetching booking notes:', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
