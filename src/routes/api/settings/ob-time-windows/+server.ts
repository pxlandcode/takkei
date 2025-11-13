import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { isAdministrator, json, resolveUserWithRoles } from '../helpers';
import { normalizePayload } from './helpers';

export const GET: RequestHandler = async ({ locals }) => {
        const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
        if (!authUser) {
                return new Response('Unauthorized', { status: 401 });
        }

        if (!isAdministrator(roleAwareUser)) {
                return new Response('Forbidden', { status: 403 });
        }

        try {
                const rows = await query(
                        `SELECT id, name, start_minutes, end_minutes, weekday_mask, include_holidays, active, created_at, updated_at
                        FROM ob_time_windows
                        ORDER BY start_minutes ASC, name ASC`
                );
                return json({ data: rows });
        } catch (error) {
                console.error('Failed to fetch OB time windows', error);
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
                console.error('Invalid JSON payload for OB time window create', error);
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
                        `INSERT INTO ob_time_windows (name, start_minutes, end_minutes, weekday_mask, include_holidays, active)
                        VALUES ($1, $2, $3, $4, $5, $6)
                        RETURNING id, name, start_minutes, end_minutes, weekday_mask, include_holidays, active, created_at, updated_at`,
                        [
                                values.name,
                                values.start_minutes,
                                values.end_minutes,
                                values.weekday_mask,
                                values.include_holidays,
                                values.active
                        ]
                );

                const created = rows[0];
                return json({ data: created }, 201);
        } catch (error) {
                console.error('Failed to create OB time window', error);
                return new Response('Internal Server Error', { status: 500 });
        }
};
