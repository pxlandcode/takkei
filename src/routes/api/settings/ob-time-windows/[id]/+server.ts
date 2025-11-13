import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { isAdministrator, json, normalizePayload, resolveUserWithRoles } from '../helpers';

function parseId(idParam: string | undefined) {
        const id = Number.parseInt(idParam ?? '', 10);
        return Number.isFinite(id) ? id : null;
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
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
                console.error('Invalid JSON payload for OB time window update', error);
                return json({ errors: { _form: 'Ogiltig begäran' } }, 400);
        }

        const { errors, values } = normalizePayload(body);
        if (
                Object.keys(errors).length > 0 ||
                values.start_minutes === null ||
                values.end_minutes === null ||
                values.weekday_mask === null
        ) {
                return json({ errors }, 400);
        }

        try {
                const rows = await query(
                        `UPDATE ob_time_windows
                        SET name = $1,
                                start_minutes = $2,
                                end_minutes = $3,
                                weekday_mask = $4,
                                include_holidays = $5,
                                active = $6,
                                updated_at = NOW()
                        WHERE id = $7
                        RETURNING id, name, start_minutes, end_minutes, weekday_mask, include_holidays, active, created_at, updated_at`,
                        [
                                values.name,
                                values.start_minutes,
                                values.end_minutes,
                                values.weekday_mask,
                                values.include_holidays,
                                values.active,
                                id
                        ]
                );

                const updated = rows[0];
                if (!updated) {
                        return new Response('Not Found', { status: 404 });
                }

                return json({ data: updated });
        } catch (error) {
                console.error('Failed to update OB time window', error);
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
                const rows = await query('DELETE FROM ob_time_windows WHERE id = $1 RETURNING id', [id]);
                const deleted = rows[0];
                if (!deleted) {
                        return new Response('Not Found', { status: 404 });
                }

                return new Response(null, { status: 204 });
        } catch (error) {
                console.error('Failed to delete OB time window', error);
                return new Response('Internal Server Error', { status: 500 });
        }
};
