import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/db'; // Adjust if your db import is elsewhere
import { respondJsonWithEtag } from '$lib/server/http-cache';

export const GET: RequestHandler = async ({ url, request }) => {
	const from = url.searchParams.get('from');
	const to = url.searchParams.get('to');
	const trainerId = url.searchParams.get('trainerId');
	const clientId = url.searchParams.get('clientId');

	if (!from || !to) {
		return json({ error: 'Missing from/to' }, { status: 400 });
	}
	if (trainerId && clientId) {
		return json({ error: 'Pass only trainerId OR clientId, not both' }, { status: 400 });
	}

	// Build filter
	const params: any[] = [from, to];
	let condition = `start_time >= $1::date AND start_time < ($2::date + INTERVAL '1 day') AND cancel_time IS NULL`;

	if (trainerId) {
		params.push(parseInt(trainerId));
		condition += ` AND trainer_id = $${params.length}`;
	}
	if (clientId) {
		params.push(parseInt(clientId));
		condition += ` AND client_id = $${params.length}`;
	}

	// Query booking counts grouped by date
	const sql = `
		SELECT
			(start_time AT TIME ZONE 'Europe/Stockholm')::date AS date,
			COUNT(*) AS count
		FROM bookings
		WHERE ${condition}
		GROUP BY (start_time AT TIME ZONE 'Europe/Stockholm')::date
		ORDER BY date
	`;

	const rows = await query(sql, params);

	// Convert to { [date]: count }
	const result: Record<string, number> = {};
	for (const row of rows) {
		result[row.date.toISOString().slice(0, 10)] = parseInt(row.count);
	}

	return respondJsonWithEtag(request, result, {
		headers: { 'Cache-Control': 'public, max-age=120' }
	});
};
