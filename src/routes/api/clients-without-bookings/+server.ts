import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function GET({ url }) {
	const trainerId = url.searchParams.get('trainer_id');
	if (!trainerId) return json({ error: 'Missing trainer_id' }, { status: 400 });

	// Calculate date ranges
	const today = new Date();
	const day = today.getDay();
	const daysUntilNextMonday = (8 - day) % 7 || 7;

	const week1Start = new Date(today);
	week1Start.setDate(today.getDate() + daysUntilNextMonday);
	week1Start.setHours(0, 0, 0, 0);

	const week1End = new Date(week1Start);
	week1End.setDate(week1Start.getDate() + 7);

	const week2End = new Date(week1End);
	week2End.setDate(week2End.getDate() + 7);

	const params = [
		trainerId,
		week1Start.toISOString(),
		week1End.toISOString(),
		week1End.toISOString(),
		week2End.toISOString()
	];

	const sql = `
        WITH trainer_clients AS (
        SELECT id, firstname, lastname
        FROM clients
        WHERE active = true AND primary_trainer_id = $1
    ),
    booked_week1 AS (
        SELECT DISTINCT client_id
        FROM bookings
        WHERE start_time >= $2 AND start_time < $3
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
            WHEN bw1.client_id IS NULL THEN 'week1'
            ELSE NULL
        END AS no_booking_week1,
        CASE
            WHEN bw2.client_id IS NULL THEN 'week2'
            ELSE NULL
        END AS no_booking_week2
    FROM trainer_clients tc
    LEFT JOIN booked_week1 bw1 ON tc.id = bw1.client_id
    LEFT JOIN booked_week2 bw2 ON tc.id = bw2.client_id
	`;

	const results = await query(sql, params);

	// Split into week1 and week2 arrays
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

	return json({ week1, week2 });
}
