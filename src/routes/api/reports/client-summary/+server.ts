import { json, type RequestHandler } from '@sveltejs/kit';
import { getClientReport } from '$lib/services/api/reports/clientSummary';

function parseActiveParam(value: string | null): 'all' | 'active' | 'inactive' {
	if (!value) return 'all';
	const lower = value.toLowerCase();
	if (['active', '1', 'true', 'yes'].includes(lower)) return 'active';
	if (['inactive', '0', 'false', 'no'].includes(lower)) return 'inactive';
	return 'all';
}

function parsePositiveInt(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) return undefined;
	return parsed;
}

export const GET: RequestHandler = async ({ url }) => {
	const active = parseActiveParam(url.searchParams.get('active'));
	const search = url.searchParams.get('search') ?? undefined;
	const limit = parsePositiveInt(url.searchParams.get('limit'));
	const offset = parsePositiveInt(url.searchParams.get('offset'));

	try {
		const report = await getClientReport({ active, search, limit, offset });
		return json(report);
	} catch (error) {
		console.error('Failed to fetch client report', error);
		return json({ error: 'Failed to fetch client report' }, { status: 500 });
	}
};
