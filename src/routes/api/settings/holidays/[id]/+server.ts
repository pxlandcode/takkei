import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { isAdministrator, json, resolveUserWithRoles } from '../../helpers';
import { mapHolidayRow, validateHolidayPayload, type HolidayRow } from '../helpers';

function parseId(idParam: string | undefined) {
        const id = Number.parseInt(idParam ?? '', 10);
        return Number.isFinite(id) ? id : null;
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
                console.error('Invalid JSON payload for holiday update', error);
                return json({ errors: { _form: 'Ogiltig begäran' } }, 400);
        }

        const { errors, values } = validateHolidayPayload(body);
        if (errors.name || errors.date || !values.name || !values.date) {
                return json({ errors }, 400);
        }

        try {
                const rows = await query<HolidayRow>(
                        `UPDATE holidays
                         SET name = $1,
                             date = $2::date,
                             description = $3,
                             updated_at = NOW()
                         WHERE id = $4
                         RETURNING id, name, date::date AS date, description, created_at, updated_at`,
                        [values.name, values.date, values.description, id]
                );
                const updated = rows[0];
                if (!updated) {
                        return new Response('Not Found', { status: 404 });
                }

                return json({ data: mapHolidayRow(updated) });
        } catch (error) {
                console.error('Failed to update holiday', error);
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
                const rows = await query('DELETE FROM holidays WHERE id = $1 RETURNING id', [id]);
                const deleted = rows[0];
                if (!deleted) {
                        return new Response('Not Found', { status: 404 });
                }

                return new Response(null, { status: 204 });
        } catch (error) {
                console.error('Failed to delete holiday', error);
                return new Response('Internal Server Error', { status: 500 });
        }
};
