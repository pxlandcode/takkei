import { query } from '$lib/db';

export async function getNotificationsForUser(userId: number) {
	if (!userId) throw new Error('Missing userId');

	const result = await query(
		`
		SELECT 
			events.*,
			COALESCE(event_types.type, 'info') AS event_type,
			users.id AS creator_id,
			users.firstname,
			users.lastname
		FROM events
		LEFT JOIN event_types ON events.event_type_id = event_types.id
		LEFT JOIN users ON events.created_by = users.id
		WHERE $1 = ANY(events.user_ids)
		AND events.id NOT IN (
			SELECT event_id FROM events_done WHERE user_id = $1
		)
		AND events.active = true
		ORDER BY events.start_time ASC
	`,
		[userId]
	);

	// Format created_by object into each event
	return result.map((event) => {
		const { creator_id, firstname, lastname, ...rest } = event;
		return {
			...rest,
			created_by: creator_id
				? {
						id: creator_id,
						name: `${firstname} ${lastname}`
					}
				: null
		};
	});
}

/**
 * Create a new notification (event)
 */
export async function createNotification({
	name,
	description,
	user_ids,
	start_time,
	end_time,
	event_type_id = null,
	created_by
}: {
	name: string;
	description: string;
	user_ids: number[];
	start_time: string;
	end_time?: string | null;
	event_type_id?: number | null;
	created_by: number;
}) {
	if (!name || !user_ids?.length || !start_time || !created_by) {
		throw new Error('Missing required fields');
	}

	const [event] = await query(
		`INSERT INTO events (
			name,
			description,
			user_ids,
			start_time,
			end_time,
			event_type_id,
			created_by,
			created_at,
			updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
		) RETURNING *`,
		[name, description, user_ids, start_time, end_time, event_type_id, created_by]
	);

	if (!event) {
		throw new Error('Failed to create notification');
	}

	return event;
}

/**
 * Mark a notification as done for a specific user
 */
export async function markNotificationAsDone(event_id: number, user_id: number) {
	if (!event_id || !user_id) throw new Error('Missing event_id or user_id');

	await query(
		`INSERT INTO events_done (event_id, user_id)
		 VALUES ($1, $2)
		 ON CONFLICT DO NOTHING`,
		[event_id, user_id]
	);

	return true;
}
