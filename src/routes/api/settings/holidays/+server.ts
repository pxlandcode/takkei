import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { respondJsonWithEtag } from '$lib/server/http-cache';
import { isAdministrator, json, resolveUserWithRoles } from '../helpers';
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

		return respondJsonWithEtag(request, { data: holidays, meta: { years } });
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
