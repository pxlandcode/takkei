import { query } from '$lib/db';

export async function getNotificationsForUser(userId: number, type?: number) {
	if (!userId) throw new Error('Missing userId');

	let baseQuery = `
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
	`;

	const params: (number | string)[] = [userId];

	if (type) {
		baseQuery += ` AND events.event_type_id = $2`;
		params.push(type);
	}

	baseQuery += ` ORDER BY events.start_time ASC`;

	const result = await query(baseQuery, params);

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

/**
 * Unmark a notification as done for a specific user
 */

export async function unmarkNotificationAsDone(event_id: number, user_id: number) {
	if (!event_id || !user_id) throw new Error('Missing event_id or user_id');

	await query(`DELETE FROM events_done WHERE event_id = $1 AND user_id = $2`, [event_id, user_id]);

	return true;
}

/**
 * Get notifications created by a specific user (admin view)
 * Includes recipient done status and pagination
 */
export async function getSentNotifications({ userId, offset = 0, limit = 10 }) {
	if (!userId) throw new Error('Missing userId');

	const results = await query(
		`
		SELECT
			e.*,
			COALESCE(et.type, 'info') AS event_type,
			u.id AS creator_id,
			u.firstname,
			u.lastname,
			(
				SELECT COUNT(*) FROM unnest(e.user_ids) AS uid
			) AS total_receivers,
			(
				SELECT COUNT(*) FROM events_done ed WHERE ed.event_id = e.id
			) AS marked_done,
                (
                    SELECT json_agg(json_build_object(
                        'id', u2.id,
                        'name', u2.firstname || ' ' || u2.lastname,
                        'hasMarkedDone', ed.user_id IS NOT NULL,
                        'event_id', e.id
                    ))
                    FROM unnest(e.user_ids) AS uid(user_id)
                    LEFT JOIN users u2 ON u2.id = uid.user_id
                    LEFT JOIN events_done ed ON ed.user_id = uid.user_id AND ed.event_id = e.id
                ) AS recipients
		FROM events e
		LEFT JOIN event_types et ON e.event_type_id = et.id
		LEFT JOIN users u ON e.created_by = u.id
		WHERE e.created_by = $1
		ORDER BY e.created_at DESC
		LIMIT $2 OFFSET $3
		`,
		[userId, limit, offset]
	);

	return results.map((event) => {
		const { creator_id, firstname, lastname, recipients, ...rest } = event;

		return {
			...rest,
			recipients: Array.isArray(recipients) ? recipients : recipients ? JSON.parse(recipients) : [],
			created_by: creator_id ? { id: creator_id, name: `${firstname} ${lastname}` } : null
		};
	});
}

export async function deleteNotification(id: number) {
	if (!id) throw new Error('Missing notification id');

	await query(`DELETE FROM events_done WHERE event_id = $1`, [id]);

	await query(`DELETE FROM events WHERE id = $1`, [id]);
}
