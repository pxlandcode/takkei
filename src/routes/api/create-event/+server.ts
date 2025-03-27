import { query } from '$lib/db';
import type { RequestHandler } from '@sveltejs/kit';
import type { EventInfo } from '$lib/types/event';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data: Partial<EventInfo> = await request.json();

		const name = data.name ?? '';
		const user_ids = data.user_ids ?? [];
		const start_time = data.start_time ?? new Date().toISOString();
		const end_time = data.end_time ?? new Date().toISOString();
		const notify_at = data.notify_at ?? 'start_time';
		const description = data.description ?? '';
		const active = data.active ?? true;
		const done = data.done ?? false;
		const repeat_yearly = data.repeat_yearly ?? false;
		const repeat_monthly = data.repeat_monthly ?? false;
		const repeat_weekly = data.repeat_weekly ?? false;
		const repeat_of_id = data.repeat_of_id ?? null;
		const shared_event_ids = data.shared_event_ids ?? [];
		const personal = data.personal ?? false;

		// Convert `user_ids` and `shared_event_ids` to PostgreSQL array format
		const pgUserIds = user_ids.length > 0 ? `{${user_ids.join(',')}}` : '{}';
		const pgSharedEventIds = shared_event_ids.length > 0 ? `{${shared_event_ids.join(',')}}` : '{}';

		const result = await query(
			`
      INSERT INTO events 
        (name, user_ids, start_time, end_time, notify_at, description, active, done, repeat_yearly, repeat_monthly, repeat_weekly, repeat_of_id, shared_event_ids, personal, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING id
      `,
			[
				name,
				pgUserIds,
				start_time,
				end_time,
				notify_at,
				description,
				active,
				done,
				repeat_yearly,
				repeat_monthly,
				repeat_weekly,
				repeat_of_id,
				pgSharedEventIds,
				personal
			]
		);

		const eventId = result[0].id;

		return new Response(JSON.stringify({ message: 'Event created successfully', eventId }), {
			status: 201
		});
	} catch (error) {
		console.error('Error creating event:', error);
		return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
	}
};
