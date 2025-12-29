import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { isAdministrator, json, resolveUserWithRoles } from '../helpers';

function parseTimestamp(value: any): number | undefined {
	if (!value) return undefined;
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
	if (typeof value === 'string') {
		const normalized = value.replace(' ', 'T');
		const withZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
		const ms = Date.parse(withZone);
		if (!Number.isNaN(ms)) return ms;
	}
	const ms = Date.parse(String(value));
	return Number.isNaN(ms) ? undefined : ms;
}
import {
        mapHolidayRow,
        parseShowPassedParam,
        validateHolidayPayload,
        type HolidayRow
} from './helpers';

export const GET: RequestHandler = async ({ locals, url, request }) => {
        const { authUser, roleAwareUser } = await resolveUserWithRoles(locals);
        if (!authUser) {
                return new Response('Unauthorized', { status: 401 });
        }

        if (!isAdministrator(roleAwareUser)) {
                return new Response('Forbidden', { status: 403 });
        }

        const showPassed = parseShowPassedParam(url.searchParams.get('showPassed'));

        try {
                const ifModifiedSince = request.headers.get('if-modified-since');
                if (ifModifiedSince) {
                        const [row] = await query<{ last_updated: string | null }>(
                                `SELECT MAX(updated_at) AS last_updated FROM holidays`
                        );
                        const latestMs = parseTimestamp(row?.last_updated);
                        const since = Date.parse(ifModifiedSince);
                        if (Number.isFinite(latestMs) && Number.isFinite(since) && since >= latestMs) {
                                const headers: Record<string, string> = { 'content-type': 'application/json' };
                                headers['last-modified'] = new Date(
                                        Math.floor(latestMs / 1000) * 1000
                                ).toUTCString();
                                return new Response(null, { status: 304, headers });
                        }
                }

                const [holidaysResult, yearsResult] = await Promise.all([
                        query<HolidayRow>(
                                `SELECT id,
                                        name,
                                        date::date AS date,
                                        description,
                                        created_at,
                                        updated_at
                                 FROM holidays
                                 ${showPassed ? '' : 'WHERE date::date >= CURRENT_DATE'}
                                 ORDER BY date::date ASC, name ASC`
                        ),
                        query<{ year: number }>(
                                `SELECT DISTINCT EXTRACT(YEAR FROM date::date)::int AS year
                                 FROM holidays
                                 ORDER BY year ASC`
                        )
                ]);

                const holidays = holidaysResult.map(mapHolidayRow);
                const years = yearsResult
                        .map((row) => Number(row.year))
                        .filter((year) => Number.isFinite(year));

                let maxUpdatedMs = holidaysResult
                        .map((row) => row?.updated_at || row?.updatedAt || row?.created_at || row?.createdAt)
                        .map((ts) => parseTimestamp(ts))
                        .filter((n): n is number => Number.isFinite(n))
                        .sort((a, b) => b - a)[0];

                if (!Number.isFinite(maxUpdatedMs)) {
                        const [row] = await query<{ last_updated: string | null }>(
                                `SELECT MAX(updated_at) AS last_updated FROM holidays`
                        );
                        maxUpdatedMs = parseTimestamp(row?.last_updated) ?? 0;
                }

                const headers: Record<string, string> = { 'content-type': 'application/json' };
                const roundedMs = Number.isFinite(maxUpdatedMs) ? Math.floor(maxUpdatedMs / 1000) * 1000 : 0;
                headers['last-modified'] = new Date(roundedMs).toUTCString();

                const ifModifiedSince = request.headers.get('if-modified-since');
                if (ifModifiedSince) {
                        const since = Date.parse(ifModifiedSince);
                        if (Number.isFinite(since) && since >= roundedMs) {
                                return new Response(null, { status: 304, headers });
                        }
                }

                return new Response(JSON.stringify({ data: holidays, meta: { years } }), {
                        status: 200,
                        headers
                });
        } catch (error) {
                console.error('Failed to fetch holidays', error);
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
                console.error('Invalid JSON payload for holiday create', error);
                return json({ errors: { _form: 'Ogiltig begäran' } }, 400);
        }

        const { errors, values } = validateHolidayPayload(body);
        if (errors.name || errors.date || !values.name || !values.date) {
                return json({ errors }, 400);
        }

        try {
                const rows = await query<HolidayRow>(
                        `INSERT INTO holidays (name, date, description)
                         VALUES ($1, $2::date, $3)
                         RETURNING id, name, date::date AS date, description, created_at, updated_at`,
                        [values.name, values.date, values.description]
                );
                const created = rows[0];
                return json({ data: mapHolidayRow(created) }, 201);
        } catch (error) {
                console.error('Failed to create holiday', error);
                return new Response('Internal Server Error', { status: 500 });
        }
};
