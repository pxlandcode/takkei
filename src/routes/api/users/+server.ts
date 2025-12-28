import { query } from '$lib/db';

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

export async function GET({ request }) {
	const queryStr = `
        SELECT 
            users.*, 
            COALESCE(json_agg(DISTINCT roles) FILTER (WHERE roles.id IS NOT NULL), '[]') AS roles,
            locations.name AS default_location
        FROM users
        LEFT JOIN roles ON users.id = roles.user_id
        LEFT JOIN locations ON users.default_location_id = locations.id
        GROUP BY users.id, locations.name
        ORDER BY users.firstname
    `;

	try {
		const result = await query(queryStr);

		let maxUpdatedMs = result
			.map((row) => row?.updated_at || row?.created_at || row?.updatedAt || row?.createdAt)
			.map((ts) => parseTimestamp(ts))
			.filter((n): n is number => Number.isFinite(n))
			.sort((a, b) => b - a)[0];

		if (!Number.isFinite(maxUpdatedMs)) {
			const [row] = await query<{ last_updated: string | null }>(
				`SELECT MAX(updated_at) AS last_updated FROM users`
			);
			maxUpdatedMs = parseTimestamp(row?.last_updated) ?? 0;
		}

		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		const roundedMs = Number.isFinite(maxUpdatedMs) ? Math.floor(maxUpdatedMs / 1000) * 1000 : 0;
		headers['Last-Modified'] = new Date(roundedMs).toUTCString();

		const ifModifiedSince = request.headers.get('if-modified-since');
		if (ifModifiedSince) {
			const since = Date.parse(ifModifiedSince);
			if (Number.isFinite(since) && since >= roundedMs) {
				return new Response(null, { status: 304, headers });
			}
		}

		return new Response(JSON.stringify(result), { status: 200, headers });
	} catch (error) {
		console.error('Error fetching users:', error);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
	}
}
