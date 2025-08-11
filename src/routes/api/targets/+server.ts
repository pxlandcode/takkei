import { query } from '$lib/db';
import { getUserTargets } from '$lib/services/api/targetApiService';

export async function GET({ url }) {
	const userId = url.searchParams.get('userId');
	const date = url.searchParams.get('date');

	if (!userId || !date) {
		console.warn('Missing required parameters', { userId, date });
		return new Response(JSON.stringify({ error: 'Missing required parameters' }), { status: 400 });
	}

	try {
		const targets = await getUserTargets(Number(userId), date);

		return new Response(JSON.stringify(targets), { status: 200 });
	} catch (error) {
		console.error('❌ Error fetching targets:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const body = await request.json();

		const {
			title,
			description,
			target,
			target_kind_id,
			user_ids,
			location_ids,
			start_date,
			end_date
		} = body;

		if (!title || !target_kind_id || (!user_ids.length && !location_ids.length)) {
			return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
		}

		const insertQuery = `
			INSERT INTO targets (
				title,
				description,
				target,
				achieved,
				target_kind_id,
				user_ids,
				location_ids,
				start_date,
				end_date,
				created_at,
				updated_at
			)
			VALUES (
				$1, $2, $3, 0, $4, $5, $6, $7, $8, NOW(), NOW()
			)
		`;

		const params = [
			title,
			description ?? '',
			target,
			target_kind_id,
			user_ids,
			location_ids,
			start_date,
			end_date
		];

		await query(insertQuery, params);

		return new Response(JSON.stringify({ success: true }), { status: 201 });
	} catch (error) {
		console.error('Error creating target:', error);
		return new Response(JSON.stringify({ error: 'Failed to create target' }), { status: 500 });
	}
}
