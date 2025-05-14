import { query } from '$lib/db';
import { json } from '@sveltejs/kit';

export async function GET({ url }) {
	const userId = Number(url.searchParams.get('user_id'));
	if (!userId) return json({ error: 'Missing user_id' }, { status: 400 });

	const result = await query(
		`
		SELECT
			events.*,
			COALESCE(event_types.type, 'info') AS event_type,
			users.id AS creator_id,
			users.firstname,
			users.lastname,
			(
				SELECT COUNT(*) FROM unnest(events.user_ids) AS u(id)
			) AS total_receivers,
			(
				SELECT COUNT(*) FROM events_done ed WHERE ed.event_id = events.id
			) AS marked_done
		FROM events
		LEFT JOIN event_types ON events.event_type_id = event_types.id
		LEFT JOIN users ON events.created_by = users.id
		WHERE events.created_by = $1
		ORDER BY events.created_at DESC
	`,
		[userId]
	);

	return json(result);
}
