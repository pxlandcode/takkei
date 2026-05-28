import { json, type RequestHandler } from '@sveltejs/kit';
import {
	getClientsPackagesStatusRows,
	normalizeSessionsLimit
} from '$lib/server/exports/clientsPackagesStatus';

function parseNonNegativeInt(value: string | null, fallback: number) {
	const parsed = Number.parseInt(value ?? '', 10);
	if (!Number.isFinite(parsed) || parsed < 0) return fallback;
	return parsed;
}

export const GET: RequestHandler = async ({ url }) => {
	const sessionsLimit = normalizeSessionsLimit(url.searchParams.get('sessions_limit'));
	const limit = parseNonNegativeInt(url.searchParams.get('limit'), 50);
	const offset = parseNonNegativeInt(url.searchParams.get('offset'), 0);

	try {
		const rows = await getClientsPackagesStatusRows({ sessionsLimit, limit, offset });
		return json({
			rows,
			sessionsLimit,
			generatedAt: new Date().toISOString()
		});
	} catch (error) {
		console.error('Failed to fetch clients packages status rows', error);
		return json({ error: 'Failed to fetch clients packages status rows' }, { status: 500 });
	}
};
