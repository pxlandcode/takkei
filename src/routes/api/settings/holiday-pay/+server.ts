import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { isAdministrator, json, resolveUserWithRoles } from '../helpers';
import { mapHolidayPayRow, normalizeAmount, parseTimestamp, type HolidayPayRow } from './helpers';

async function latestUpdatedMs(): Promise<number | undefined> {
	const [row] = await query<{ last_updated: string | null }>(
		`SELECT GREATEST(
                        COALESCE((SELECT MAX(updated_at) FROM holiday_pay), 'epoch'::timestamptz),
                        COALESCE((SELECT MAX(updated_at) FROM users), 'epoch'::timestamptz)
                ) AS last_updated`
	);
	return parseTimestamp(row?.last_updated);
}

export const GET: RequestHandler = async ({ locals, request }) => {
	const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!isAdministrator(roleAwareUser)) {
		return new Response('Forbidden', { status: 403 });
	}

	try {
		const ifModifiedSince = request.headers.get('if-modified-since');
		if (ifModifiedSince) {
			const latestMs = await latestUpdatedMs();
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
                         ORDER BY u.firstname ASC, u.lastname ASC`
		);

		const data = rows.map(mapHolidayPayRow);

		let maxUpdatedMs = data
			.map((row) => parseTimestamp(row.updatedAt ?? row.createdAt))
			.filter((n): n is number => Number.isFinite(n))
			.sort((a, b) => b - a)[0];

		if (!Number.isFinite(maxUpdatedMs)) {
			maxUpdatedMs = (await latestUpdatedMs()) ?? 0;
		}

		const roundedMs = Number.isFinite(maxUpdatedMs) ? Math.floor((maxUpdatedMs as number) / 1000) * 1000 : 0;

		return new Response(JSON.stringify({ data }), {
			status: 200,
			headers: {
				'content-type': 'application/json',
				'last-modified': new Date(roundedMs).toUTCString()
			}
		});
	} catch (error) {
		console.error('Failed to fetch holiday pay', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!isAdministrator(roleAwareUser)) {
		return new Response('Forbidden', { status: 403 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch (error) {
		console.error('Invalid JSON payload for holiday pay', error);
		return json({ errors: { _form: 'Invalid request' } }, 400);
	}

	const userId = Number(body.userId ?? body.user_id);
	const amount = normalizeAmount(body.amount);

	const errors: Record<string, string> = {};
	if (!Number.isFinite(userId) || userId <= 0) {
		errors.userId = 'Invalid user.';
	}
	if (amount === null || !Number.isFinite(amount)) {
		errors.amount = 'Enter a valid amount.';
	} else if ((amount as number) < 0) {
		errors.amount = 'Amount cannot be negative.';
	}

	if (Object.keys(errors).length) {
		return json({ errors }, 400);
	}

	try {
		const userExists = await query<{ id: number }>('SELECT id FROM users WHERE id = $1', [userId]);
		if (!userExists?.length) {
			return json({ errors: { userId: 'User not found.' } }, 404);
		}

		const rows = await query<HolidayPayRow>(
			`WITH upserted AS (
                                INSERT INTO holiday_pay (user_id, amount, created_at, updated_at)
                                VALUES ($1, $2, NOW(), NOW())
                                ON CONFLICT (user_id) DO UPDATE
                                SET amount = EXCLUDED.amount,
                                    updated_at = NOW()
                                RETURNING user_id, amount::float AS amount, created_at, updated_at
                        )
                        SELECT
                                u.id AS user_id,
                                u.firstname,
                                u.lastname,
                                upserted.amount,
                                upserted.created_at,
                                upserted.updated_at
                        FROM users u
                        JOIN upserted ON upserted.user_id = u.id`,
			[userId, amount]
		);

		const saved = rows[0];
		if (!saved) {
			return json({ errors: { userId: 'User could not be updated.' } }, 404);
		}

		const mapped = mapHolidayPayRow(saved);
		const updatedMs = parseTimestamp(mapped.updatedAt ?? mapped.createdAt) ?? Date.now();
		const roundedUpdated = Math.floor(updatedMs / 1000) * 1000;

		return new Response(JSON.stringify({ data: mapped }), {
			status: 200,
			headers: {
				'content-type': 'application/json',
				'last-modified': new Date(roundedUpdated).toUTCString()
			}
		});
	} catch (error) {
		console.error('Failed to save holiday pay', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
