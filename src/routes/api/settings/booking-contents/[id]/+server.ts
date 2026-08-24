import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { isAdministrator, json, resolveUserWithRoles } from '../../helpers';
import {
	mapBookingContentRow,
	validateBookingContentPayload,
	type BookingContentRow
} from '$lib/server/bookingContents';

function parseId(idParam: string | undefined) {
	const id = Number.parseInt(idParam ?? '', 10);
	return Number.isFinite(id) ? id : null;
}

async function hasDuplicateKind(kind: string, id: number) {
	const rows = await query<{ id: number }>(
		`SELECT id
		 FROM booking_contents
		 WHERE id <> $2
		   AND LOWER(TRIM(kind)) = LOWER(TRIM($1))
		 LIMIT 1`,
		[kind, id]
	);
	return rows.length > 0;
}

async function fetchBookingContentWithCount(id: number) {
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
		 WHERE bc.id = $1
		 GROUP BY bc.id, bc.kind, bc.icon, bc.active, bc.created_at, bc.updated_at`,
		[id]
	);

	return rows[0] ?? null;
}

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const id = parseId(params.id);
	if (id === null) {
		return json({ errors: { id: 'Ogiltigt id' } }, 400);
	}

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
		console.error('Invalid JSON payload for booking content update', error);
		return json({ errors: { _form: 'Ogiltig begäran' } }, 400);
	}

	const { errors, values } = validateBookingContentPayload(body);
	if (Object.keys(errors).length > 0) {
		return json({ errors }, 400);
	}

	try {
		if (await hasDuplicateKind(values.kind, id)) {
			return json({ errors: { kind: 'Passtypen finns redan' } }, 400);
		}

		const rows = await query<BookingContentRow>(
			`UPDATE booking_contents
			 SET kind = $1,
			     icon = $2,
			     active = $3,
			     updated_at = NOW()
			 WHERE id = $4
			 RETURNING id, kind, icon, active, created_at, updated_at`,
			[values.kind, values.icon, values.active, id]
		);

		const updated = rows[0];
		if (!updated) {
			return new Response('Not Found', { status: 404 });
		}

		const refreshed = await fetchBookingContentWithCount(id);
		return json({ data: mapBookingContentRow(refreshed ?? updated) });
	} catch (error) {
		console.error('Failed to update booking content', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const id = parseId(params.id);
	if (id === null) {
		return json({ errors: { id: 'Ogiltigt id' } }, 400);
	}

	const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	if (!isAdministrator(roleAwareUser)) {
		return new Response('Forbidden', { status: 403 });
	}

	try {
		const existing = await fetchBookingContentWithCount(id);
		if (!existing) {
			return new Response('Not Found', { status: 404 });
		}

		const bookingsCount = Number(existing.bookings_count ?? 0);
		if (bookingsCount > 0) {
			const rows = await query<BookingContentRow>(
				`UPDATE booking_contents
				 SET active = FALSE,
				     updated_at = NOW()
				 WHERE id = $1
				 RETURNING id, kind, icon, active, created_at, updated_at`,
				[id]
			);
			const updated = rows[0];
			if (!updated) {
				return new Response('Not Found', { status: 404 });
			}
			const deactivated = {
				...updated,
				bookings_count: bookingsCount
			};

			return json({
				data: mapBookingContentRow(deactivated),
				deactivated: true,
				deleted: false
			});
		}

		await query('DELETE FROM booking_contents WHERE id = $1', [id]);
		return json({ data: { id }, deactivated: false, deleted: true });
	} catch (error) {
		console.error('Failed to delete booking content', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
