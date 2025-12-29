import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import { getTrainerStatisticsService } from '$lib/services/api/statistics/trainerStatisticsService';
import type { RequestHandler } from '@sveltejs/kit';

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
	const trainerIdParam = url.searchParams.get('trainerId');
	const trainerId = trainerIdParam ? Number(trainerIdParam) : NaN;

	if (!Number.isFinite(trainerId) || trainerId <= 0) {
		return json({ error: 'Invalid trainerId parameter' }, { status: 400 });
	}

	const from = url.searchParams.get('from') ?? undefined;
	const to = url.searchParams.get('to') ?? undefined;

	const ifModifiedSince = request.headers.get('if-modified-since');
	let latestMs: number | undefined;
	if (ifModifiedSince) {
		const params: any[] = [trainerId];
		let latestSql = `SELECT MAX(updated_at) AS last_updated FROM bookings WHERE trainer_id = $1`;
		if (from) {
			params.push(from);
			latestSql += ` AND start_time >= $${params.length}::date`;
		}
		if (to) {
			params.push(to);
			latestSql += ` AND start_time <= ($${params.length}::date + INTERVAL '1 day')`;
		}

		const [row] = await query<{ last_updated: string | null }>(latestSql, params);
		latestMs = parseTimestamp(row?.last_updated);
		const since = Date.parse(ifModifiedSince);
		if (Number.isFinite(latestMs) && Number.isFinite(since) && since >= latestMs) {
			const headers: Record<string, string> = {
				'Last-Modified': new Date(Math.floor(latestMs / 1000) * 1000).toUTCString()
			};
			console.info('statistics 304 preflight', { trainerId, from, to, since, latestMs, headers });
			return new Response(null, { status: 304, headers });
		}
		console.info('statistics preflight miss', { trainerId, from, to, ifModifiedSince, latestMs, since });
	} else {
		console.info('statistics no if-modified-since header', { trainerId, from, to });
	}

	try {
		const result = await getTrainerStatisticsService({ trainerId, from, to });

		const updatedAt = result?.debiterbaraBokningar?.currentMonth?.updated_at as string | undefined;
		const fallback = parseTimestamp(updatedAt);
		const rounded = Number.isFinite(fallback)
			? Math.floor((fallback as number) / 1000) * 1000
			: latestMs
				? Math.floor((latestMs as number) / 1000) * 1000
				: Date.now();
		const headers: Record<string, string> = {
			'Last-Modified': new Date(rounded).toUTCString()
		};
		console.info('statistics 200', { trainerId, from, to, rounded });

		return new Response(JSON.stringify(result), { status: 200, headers });
	} catch (error) {
		console.error('Failed to compute trainer statistics', {
			trainerId,
			from,
			to,
			error
		});
		return json({ error: 'Failed to compute statistics' }, { status: 500 });
	}
};
