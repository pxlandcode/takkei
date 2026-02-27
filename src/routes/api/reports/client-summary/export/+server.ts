import { type RequestHandler } from '@sveltejs/kit';
import { buildClientReportWorkbook } from '$lib/services/api/reports/clientSummary';

function parseActiveParam(value: string | null): 'all' | 'active' | 'inactive' {
	if (!value) return 'all';
	const lower = value.toLowerCase();
	if (['active', '1', 'true', 'yes'].includes(lower)) return 'active';
	if (['inactive', '0', 'false', 'no'].includes(lower)) return 'inactive';
	return 'all';
}

function parseSearch(value: string | null): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : undefined;
}

function parseOptionalId(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
	return parsed;
}

function parseDateParam(value: string | null): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

export const GET: RequestHandler = async ({ url }) => {
	const active = parseActiveParam(url.searchParams.get('active'));
	const search = parseSearch(url.searchParams.get('search'));
	const trainerId = parseOptionalId(url.searchParams.get('trainerId'));
	const locationId = parseOptionalId(url.searchParams.get('locationId'));
	const dateFrom = parseDateParam(url.searchParams.get('dateFrom'));
	const dateTo = parseDateParam(url.searchParams.get('dateTo'));

	try {
		const { buffer, filename } = await buildClientReportWorkbook({
			active,
			search,
			trainerId,
			locationId,
			dateFrom,
			dateTo
		});

		return new Response(buffer, {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (error) {
		console.error('Failed to export client report', error);
		return new Response('Failed to export client report', { status: 500 });
	}
};
