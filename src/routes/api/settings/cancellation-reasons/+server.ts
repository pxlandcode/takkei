import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { isAdministrator, json, resolveUserWithRoles } from '../helpers';
import {
	createCancellationReasonValue,
	mapCancellationReasonRow,
	validateCancellationReasonPayload,
	type CancellationReasonRow
} from '$lib/server/cancellationReasons';

async function hasDuplicateLabel(label: string) {
	const rows = await query<{ id: number }>(
		`SELECT id
		 FROM cancellation_reasons
		 WHERE LOWER(TRIM(label)) = LOWER(TRIM($1))
		 LIMIT 1`,
		[label]
	);
	return rows.length > 0;
}

async function valueExists(value: string) {
	const rows = await query<{ id: number }>(
		`SELECT id
		 FROM cancellation_reasons
		 WHERE LOWER(TRIM(value)) = LOWER(TRIM($1))
		 LIMIT 1`,
		[value]
	);
	return rows.length > 0;
}

async function createUniqueValue(label: string) {
	const baseValue = createCancellationReasonValue(label);
	let value = baseValue;
	let suffix = 2;

	while (await valueExists(value)) {
		const suffixText = `_${suffix}`;
		value = `${baseValue.slice(0, 240 - suffixText.length)}${suffixText}`;
		suffix += 1;
	}

	return value;
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
			 GROUP BY cr.id, cr.value, cr.label, cr.active, cr.created_at, cr.updated_at
			 ORDER BY cr.active DESC, LOWER(cr.label) ASC, cr.id ASC`
		);

		return json({ data: rows.map((row) => mapCancellationReasonRow(row)) });
	} catch (error) {
		console.error('Failed to fetch cancellation reason settings', error);
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
		console.error('Invalid JSON payload for cancellation reason create', error);
		return json({ errors: { _form: 'Ogiltig begäran' } }, 400);
	}

	const { errors, values } = validateCancellationReasonPayload(body);
	if (Object.keys(errors).length > 0) {
		return json({ errors }, 400);
	}

	try {
		if (await hasDuplicateLabel(values.label)) {
			return json({ errors: { label: 'Avbokningsorsaken finns redan' } }, 400);
		}

		const reasonValue = await createUniqueValue(values.label);
		const rows = await query<CancellationReasonRow>(
			`INSERT INTO cancellation_reasons (value, label, active, created_at, updated_at)
			 VALUES ($1, $2, $3, NOW(), NOW())
			 RETURNING id, value, label, active, created_at, updated_at, 0::int AS bookings_count`,
			[reasonValue, values.label, values.active]
		);

		return json({ data: mapCancellationReasonRow(rows[0]) }, 201);
	} catch (error) {
		console.error('Failed to create cancellation reason', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
