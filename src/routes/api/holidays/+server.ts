import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { json } from '../settings/helpers';
import { formatDateOnly, mapHolidayRow, resolveRange, type HolidayRow } from '../settings/holidays/helpers';

function defaultRange() {
        const today = new Date();
        const to = new Date(today);
        to.setMonth(to.getMonth() + 1);
        return {
                from: formatDateOnly(today),
                to: formatDateOnly(to)
        };
}

export const GET: RequestHandler = async ({ locals, url }) => {
        if (!locals.user) {
                return new Response('Unauthorized', { status: 401 });
        }

        const defaults = defaultRange();
        const { from, to } = resolveRange(url.searchParams, defaults);

        try {
                const rows = await query<HolidayRow>(
                        `SELECT id,
                                name,
                                date::date AS date,
                                description,
                                created_at,
                                updated_at
                         FROM holidays
                         WHERE date::date BETWEEN $1::date AND $2::date
                         ORDER BY date::date ASC, name ASC`,
                        [from, to]
                );

                return json({ data: rows.map(mapHolidayRow), range: { from, to } });
        } catch (error) {
                console.error('Failed to fetch holidays for calendar', error);
                return new Response('Internal Server Error', { status: 500 });
        }
};
