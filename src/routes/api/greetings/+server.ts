import type { RequestHandler } from '@sveltejs/kit';
import { query } from '$lib/db';
import { json, resolveUserWithRoles } from '../settings/helpers';
import { mapGreetingRow, type GreetingRow } from '../settings/greetings/helpers';

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

export const GET: RequestHandler = async ({ locals, url, request }) => {
	const { authUser } = await resolveUserWithRoles(locals);
	if (!authUser) {
		return new Response('Unauthorized', { status: 401 });
	}

	const audienceParam = (() => {
		const raw = url?.searchParams?.get('audience')?.toLowerCase();
		if (raw === 'client' || raw === 'user' || raw === 'both') return raw;
		return 'user';
	})();

	try {
		const rows = await query<GreetingRow>(
			`SELECT id, message, icon, active, audience, created_at, updated_at
                         FROM greetings
                         WHERE active = TRUE
                           AND ($1::greeting_audience_enum = 'both'::greeting_audience_enum
                                OR audience = 'both'::greeting_audience_enum
                                OR audience = $1::greeting_audience_enum)
                         ORDER BY created_at DESC, id DESC`,
			[audienceParam]
		);

		let maxUpdatedMs = rows
			.map((row) => row?.updated_at || row?.updatedAt || row?.created_at || row?.createdAt)
			.map((ts) => parseTimestamp(ts))
			.filter((n): n is number => Number.isFinite(n))
			.sort((a, b) => b - a)[0];

		if (!Number.isFinite(maxUpdatedMs)) {
			const [row] = await query<{ last_updated: string | null }>(
				`SELECT MAX(updated_at) AS last_updated FROM greetings`
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

		return new Response(JSON.stringify({ data: rows.map(mapGreetingRow) }), {
			status: 200,
			headers
		});
	} catch (error) {
		console.error('Failed to fetch greetings', error);
		return new Response('Internal Server Error', { status: 500 });
	}
};
