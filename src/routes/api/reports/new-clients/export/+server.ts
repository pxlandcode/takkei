import { type RequestHandler } from '@sveltejs/kit';
import {
	buildNewClientsReportWorkbook,
	type NewClientsReportActiveFilter,
	type NewClientsReportStartedFilter
} from '$lib/services/api/reports/newClients';

function parseActive(value: string | null): NewClientsReportActiveFilter {
	if (!value) return 'all';
	const normalized = value.toLowerCase();
	if (['active', '1', 'true', 'yes', 'aktiva'].includes(normalized)) return 'active';
	if (['inactive', '0', 'false', 'no', 'inaktiva'].includes(normalized)) return 'inactive';
	return 'all';
}

function parseStarted(value: string | null): NewClientsReportStartedFilter {
	if (!value) return 'all';
	const normalized = value.toLowerCase();
	if (['started', 'har_borjat', 'har_börjat', 'yes', '1', 'true'].includes(normalized)) {
		return 'started';
	}
	if (['not_started', 'inte_borjat', 'inte_börjat', 'no', '0', 'false'].includes(normalized)) {
		return 'not_started';
	}
	return 'all';
}

function parseOptionalId(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
	return parsed;
}

function parseDate(value: string | null): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function parseSearch(value: string | null): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : undefined;
}

export const GET: RequestHandler = async ({ url }) => {
	const filters = {
		active: parseActive(url.searchParams.get('active')),
		started: parseStarted(url.searchParams.get('started')),
		trainerId: parseOptionalId(url.searchParams.get('trainerId')),
		locationId: parseOptionalId(url.searchParams.get('locationId')),
		dateFrom: parseDate(url.searchParams.get('dateFrom')),
		dateTo: parseDate(url.searchParams.get('dateTo')),
		search: parseSearch(url.searchParams.get('search'))
	};

	try {
		const { buffer, filename } = await buildNewClientsReportWorkbook(filters);
		return new Response(buffer, {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (error) {
		console.error('Failed to export new clients report', error);
		return new Response('Failed to export new clients report', { status: 500 });
	}
};
