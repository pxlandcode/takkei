import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import { respondJsonWithEtag } from '$lib/server/http-cache';

export async function GET({ url, request }) {
	const trainerId = url.searchParams.get('trainer_id');
	if (!trainerId) return json({ error: 'Missing trainer_id' }, { status: 400 });

	// Calculate date ranges (this week + next two weeks)
	const today = new Date();
	const day = today.getDay();
	const daysSinceMonday = (day + 6) % 7;

	const thisWeekStart = new Date(today);
	thisWeekStart.setDate(today.getDate() - daysSinceMonday);
	thisWeekStart.setHours(0, 0, 0, 0);

	const nextWeekStart = new Date(thisWeekStart);
	nextWeekStart.setDate(nextWeekStart.getDate() + 7);

	const weekAfterNextStart = new Date(nextWeekStart);
	weekAfterNextStart.setDate(weekAfterNextStart.getDate() + 7);

	const weekThreeStart = new Date(weekAfterNextStart);
	weekThreeStart.setDate(weekThreeStart.getDate() + 7);

	const params = [
		trainerId,
		thisWeekStart.toISOString(),
		nextWeekStart.toISOString(),
		weekAfterNextStart.toISOString(),
		weekThreeStart.toISOString()
	];

	const sql = `
        WITH trainer_clients AS (
        SELECT id, firstname, lastname
        FROM clients
        WHERE active = true AND primary_trainer_id = $1
    ),
    booked_this_week AS (
        SELECT DISTINCT client_id
        FROM bookings
        WHERE start_time >= $2 AND start_time < $3
        AND cancel_time IS NULL
    ),
    booked_week1 AS (
        SELECT DISTINCT client_id
        FROM bookings
        WHERE start_time >= $3 AND start_time < $4
        AND cancel_time IS NULL
    ),
    booked_week2 AS (
        SELECT DISTINCT client_id
        FROM bookings
        WHERE start_time >= $4 AND start_time < $5
        AND cancel_time IS NULL
    )
    SELECT
        tc.id,
        tc.firstname,
        tc.lastname,
        CASE
            WHEN btw.client_id IS NULL THEN 'thisWeek'
            ELSE NULL
        END AS no_booking_this_week,
        CASE
            WHEN bw1.client_id IS NULL THEN 'week1'
            ELSE NULL
        END AS no_booking_week1,
        CASE
            WHEN bw2.client_id IS NULL THEN 'week2'
            ELSE NULL
        END AS no_booking_week2
    FROM trainer_clients tc
    LEFT JOIN booked_this_week btw ON tc.id = btw.client_id
    LEFT JOIN booked_week1 bw1 ON tc.id = bw1.client_id
    LEFT JOIN booked_week2 bw2 ON tc.id = bw2.client_id
	`;

	const results = await query(sql, params);

	// Split into week arrays
	const thisWeek = results
		.filter((r) => r.no_booking_this_week)
		.map((r) => ({
			id: r.id,
			firstname: r.firstname,
			lastname: r.lastname
		}));

	const week1 = results
		.filter((r) => r.no_booking_week1)
		.map((r) => ({
			id: r.id,
			firstname: r.firstname,
			lastname: r.lastname
		}));

	const week2 = results
		.filter((r) => r.no_booking_week2)
		.map((r) => ({
			id: r.id,
			firstname: r.firstname,
			lastname: r.lastname
		}));

	return respondJsonWithEtag(request, { thisWeek, week1, week2 });
}
