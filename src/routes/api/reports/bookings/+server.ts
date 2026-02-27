import { json, type RequestHandler } from '@sveltejs/kit';
import {
	getBookingReport,
	type BookingReportBookingTypeFilter,
	type BookingReportFilters,
	type BookingReportStatusFilter
} from '$lib/services/api/reports/bookings';

function parseStatus(value: string | null): BookingReportStatusFilter {
	if (!value) return 'chargeable';
	const normalized = value.toLowerCase();
	if (['all', 'alla'].includes(normalized)) return 'all';
	if (['booked', 'bokade', 'new'].includes(normalized)) return 'booked';
	if (['late_cancelled', 'late-cancelled', 'sent_avbokad'].includes(normalized)) return 'late_cancelled';
	if (['cancelled', 'avbokad'].includes(normalized)) return 'cancelled';
	return 'chargeable';
}

function parseBookingType(value: string | null): BookingReportBookingTypeFilter {
	if (!value) return 'all';
	const normalized = value.toLowerCase();
	if (
		normalized === 'regular' ||
		normalized === 'demo' ||
		normalized === 'education' ||
		normalized === 'internal' ||
		normalized === 'internal_education'
	) {
		return normalized;
	}
	return 'all';
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

function parsePositiveInt(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) return undefined;
	return parsed;
}

export const GET: RequestHandler = async ({ url }) => {
	const filters: BookingReportFilters = {
		dateFrom: parseDate(url.searchParams.get('dateFrom')),
		dateTo: parseDate(url.searchParams.get('dateTo')),
		status: parseStatus(url.searchParams.get('status')),
		bookingType: parseBookingType(url.searchParams.get('bookingType')),
		trainerId: parsePositiveInt(url.searchParams.get('trainerId')),
		clientId: parsePositiveInt(url.searchParams.get('clientId')),
		locationId: parsePositiveInt(url.searchParams.get('locationId')),
		packageArticleId: parsePositiveInt(url.searchParams.get('packageArticleId')),
		trainingTypeId: parsePositiveInt(url.searchParams.get('trainingTypeId')),
		search: parseSearch(url.searchParams.get('search')),
		limit: parsePositiveInt(url.searchParams.get('limit')),
		offset: parsePositiveInt(url.searchParams.get('offset'))
	};

	try {
		const report = await getBookingReport(filters);
		return json(report);
	} catch (error) {
		console.error('Failed to fetch bookings report', error);
		return json({ error: 'Failed to fetch bookings report' }, { status: 500 });
	}
};

