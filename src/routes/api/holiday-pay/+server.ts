import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { json, resolveUserWithRoles } from '../settings/helpers';
import { mapHolidayPayRow, parseTimestamp, type HolidayPayRow } from '../settings/holiday-pay/helpers';

async function latestUpdatedForUser(userId: number): Promise<number | undefined> {
	const [row] = await query<{ last_updated: string | null }>(
		`SELECT COALESCE(
                        (SELECT updated_at FROM holiday_pay WHERE user_id = $1),
                        'epoch'::timestamptz
                ) AS last_updated`,
		[userId]
	);
	return parseTimestamp(row?.last_updated);
}

export const GET: RequestHandler = async ({ locals, request }) => {
	const { authUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (authUser.kind !== 'trainer') {
		return new Response('Forbidden', { status: 403 });
	}

	const trainerId = authUser.trainerId ?? authUser.trainer_id;
	if (!trainerId) {
		return new Response('Forbidden', { status: 403 });
	}

	try {
		const ifModifiedSince = request.headers.get('if-modified-since');
		if (ifModifiedSince) {
			const latestMs = await latestUpdatedForUser(trainerId);
			const since = Date.parse(ifModifiedSince);
			if (Number.isFinite(latestMs) && Number.isFinite(since) && since >= (latestMs as number)) {
				const rounded = Math.floor((latestMs as number) / 1000) * 1000;
				return new Response(null, {
					status: 304,
					headers: {
						'content-type': 'application/json',
						'last-modified': new Date(rounded).toUTCString()
					}
				});
			}
		}

		const rows = await query<HolidayPayRow>(
			`SELECT
                                u.id AS user_id,
                                u.firstname,
                                u.lastname,
                                COALESCE(s.amount, 0)::float AS amount,
                                s.created_at,
                                s.updated_at
                         FROM users u
                         LEFT JOIN holiday_pay s ON s.user_id = u.id
                         WHERE u.id = $1
                         LIMIT 1`,
			[trainerId]
		);

		const entry = rows[0];
		if (!entry) {
			return json({ errors: { userId: 'User not found.' } }, 404);
		}

		const mapped = mapHolidayPayRow(entry);
		let latestMs = parseTimestamp(mapped.updatedAt ?? mapped.createdAt);
		if (!Number.isFinite(latestMs)) {
			latestMs = await latestUpdatedForUser(trainerId);
		}
		const rounded = Number.isFinite(latestMs) ? Math.floor((latestMs as number) / 1000) * 1000 : 0;

		return new Response(JSON.stringify({ data: mapped }), {
			status: 200,
			headers: {
				'content-type': 'application/json',
				'last-modified': new Date(rounded).toUTCString()
			}
		});
	} catch (error) {
		console.error('Failed to fetch holiday pay for user', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
