import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { isAdministrator, json, resolveUserWithRoles } from '../helpers';
import {
	mapBookingContentRow,
	validateBookingContentPayload,
	type BookingContentRow
} from '$lib/server/bookingContents';

async function hasDuplicateKind(kind: string) {
	const rows = await query<{ id: number }>(
		`SELECT id
		 FROM booking_contents
		 WHERE LOWER(TRIM(kind)) = LOWER(TRIM($1))
		 LIMIT 1`,
		[kind]
	);
	return rows.length > 0;
}

export const GET: RequestHandler = async ({ locals }) => {
	const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!isAdministrator(roleAwareUser)) {
		return new Response('Forbidden', { status: 403 });
	}

	try {
		const rows = await query<BookingContentRow>(
			`SELECT bc.id,
			        bc.kind,
			        bc.icon,
			        bc.active,
			        bc.created_at,
			        bc.updated_at,
			        COUNT(b.id)::int AS bookings_count
			 FROM booking_contents bc
			 LEFT JOIN bookings b ON b.booking_content_id = bc.id
			 GROUP BY bc.id, bc.kind, bc.icon, bc.active, bc.created_at, bc.updated_at
			 ORDER BY bc.active DESC, LOWER(bc.kind) ASC, bc.id ASC`
		);

		return json({ data: rows.map((row) => mapBookingContentRow(row)) });
	} catch (error) {
		console.error('Failed to fetch booking contents settings', error);
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
		console.error('Invalid JSON payload for booking content create', error);
		return json({ errors: { _form: 'Ogiltig begäran' } }, 400);
	}

	const { errors, values } = validateBookingContentPayload(body);
	if (Object.keys(errors).length > 0) {
		return json({ errors }, 400);
	}

	try {
		if (await hasDuplicateKind(values.kind)) {
			return json({ errors: { kind: 'Passtypen finns redan' } }, 400);
		}

		const rows = await query<BookingContentRow>(
			`INSERT INTO booking_contents (kind, icon, active, created_at, updated_at)
			 VALUES ($1, $2, $3, NOW(), NOW())
			 RETURNING id, kind, icon, active, created_at, updated_at, 0::int AS bookings_count`,
			[values.kind, values.icon, values.active]
		);

		return json({ data: mapBookingContentRow(rows[0]) }, 201);
	} catch (error) {
		console.error('Failed to create booking content', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
