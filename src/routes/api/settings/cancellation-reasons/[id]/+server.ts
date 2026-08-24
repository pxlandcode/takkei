import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { isAdministrator, json, resolveUserWithRoles } from '../../helpers';
import {
	mapCancellationReasonRow,
	validateCancellationReasonPayload,
	type CancellationReasonRow
} from '$lib/server/cancellationReasons';

function parseId(idParam: string | undefined) {
	const id = Number.parseInt(idParam ?? '', 10);
	return Number.isFinite(id) ? id : null;
}

async function hasDuplicateLabel(label: string, id: number) {
	const rows = await query<{ id: number }>(
		`SELECT id
		 FROM cancellation_reasons
		 WHERE id <> $2
		   AND LOWER(TRIM(label)) = LOWER(TRIM($1))
		 LIMIT 1`,
		[label, id]
	);
	return rows.length > 0;
}

async function fetchCancellationReasonWithCount(id: number) {
	const rows = await query<CancellationReasonRow>(
		`SELECT cr.id,
		        cr.value,
		        cr.label,
		        cr.active,
		        cr.created_at,
		        cr.updated_at,
		        COUNT(b.id)::int AS bookings_count
		 FROM cancellation_reasons cr
		 LEFT JOIN bookings b ON b.cancel_reason = cr.value
		 WHERE cr.id = $1
		 GROUP BY cr.id, cr.value, cr.label, cr.active, cr.created_at, cr.updated_at`,
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
		console.error('Invalid JSON payload for cancellation reason update', error);
		return json({ errors: { _form: 'Ogiltig begäran' } }, 400);
	}

	const { errors, values } = validateCancellationReasonPayload(body);
	if (Object.keys(errors).length > 0) {
		return json({ errors }, 400);
	}

	try {
		if (await hasDuplicateLabel(values.label, id)) {
			return json({ errors: { label: 'Avbokningsorsaken finns redan' } }, 400);
		}

		const rows = await query<CancellationReasonRow>(
			`UPDATE cancellation_reasons
			 SET label = $1,
			     active = $2,
			     updated_at = NOW()
			 WHERE id = $3
			 RETURNING id, value, label, active, created_at, updated_at`,
			[values.label, values.active, id]
		);

		const updated = rows[0];
		if (!updated) {
			return new Response('Not Found', { status: 404 });
		}

		const refreshed = await fetchCancellationReasonWithCount(id);
		return json({ data: mapCancellationReasonRow(refreshed ?? updated) });
	} catch (error) {
		console.error('Failed to update cancellation reason', error);
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
		const existing = await fetchCancellationReasonWithCount(id);
		if (!existing) {
			return new Response('Not Found', { status: 404 });
		}

		const bookingsCount = Number(existing.bookings_count ?? 0);
		if (bookingsCount > 0) {
			const rows = await query<CancellationReasonRow>(
				`UPDATE cancellation_reasons
				 SET active = FALSE,
				     updated_at = NOW()
				 WHERE id = $1
				 RETURNING id, value, label, active, created_at, updated_at`,
				[id]
			);
			const updated = rows[0];
			if (!updated) {
				return new Response('Not Found', { status: 404 });
			}

			return json({
				data: mapCancellationReasonRow({ ...updated, bookings_count: bookingsCount }),
				deactivated: true,
				deleted: false
			});
		}

		await query('DELETE FROM cancellation_reasons WHERE id = $1', [id]);
		return json({ data: { id }, deactivated: false, deleted: true });
	} catch (error) {
		console.error('Failed to delete cancellation reason', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
