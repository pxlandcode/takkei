import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/db'; // Adjust if your db import is elsewhere

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

	// Early 304 check using latest booking update within the filter
	let latestMs: number | undefined;
	{
		const latestSql = `
			SELECT MAX(updated_at) AS last_updated
			FROM bookings
			WHERE ${condition}
		`;
		const [row] = await query<{ last_updated: string | null }>(latestSql, params);
		latestMs = parseTimestamp(row?.last_updated);
		if (!Number.isFinite(latestMs)) {
			const [fallback] = await query<{ last_updated: string | null }>(
				`SELECT MAX(updated_at) AS last_updated FROM bookings`
			);
			latestMs = parseTimestamp(fallback?.last_updated);
		}
		if (!Number.isFinite(latestMs)) {
			// If still missing, use now as a safeguard to produce a validator
			latestMs = Date.now();
		}
	}

	const ifModifiedSince = request.headers.get('if-modified-since');
	const roundedMs = Number.isFinite(latestMs) ? Math.floor((latestMs as number) / 1000) * 1000 : undefined;
	if (ifModifiedSince && Number.isFinite(roundedMs)) {
		const since = Date.parse(ifModifiedSince);
		if (Number.isFinite(since) && since >= roundedMs) {
			const headers: Record<string, string> = {
				'Last-Modified': new Date(roundedMs as number).toUTCString()
			};
			return new Response(null, { status: 304, headers });
		}
	}

	const rows = await query(sql, params);

	// Convert to { [date]: count }
	const result: Record<string, number> = {};
	for (const row of rows) {
		result[row.date.toISOString().slice(0, 10)] = parseInt(row.count);
	}

	const headers: Record<string, string> = { 'Cache-Control': 'public, max-age=120' };
	if (Number.isFinite(roundedMs)) {
		headers['Last-Modified'] = new Date(roundedMs as number).toUTCString();
	} else {
		headers['Last-Modified'] = new Date().toUTCString();
	}
	return json(result, { headers });
};
