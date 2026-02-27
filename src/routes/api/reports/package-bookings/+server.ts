import { json, type RequestHandler } from '@sveltejs/kit';
import {
	getPackageBookingReport,
	type PackageBookingReportCancellation,
	type PackageBookingReportFilters,
	type PackageBookingReportPackageStatus
} from '$lib/services/api/reports/packageBookings';

function parsePackageStatus(value: string | null): PackageBookingReportPackageStatus {
	if (!value) return 'all';
	const normalized = value.toLowerCase();
	if (normalized === 'missing' || normalized === 'linked') {
		return normalized;
	}
	return 'all';
}

function parseCancellation(value: string | null): PackageBookingReportCancellation {
	if (!value) return 'chargeable';
	const normalized = value.toLowerCase();
	if (['chargeable', 'debiterbara', 'all', 'alla'].includes(normalized)) return 'chargeable';
	if (['booked_only', 'booked', 'bokade', 'active_only'].includes(normalized)) return 'booked_only';
	if (['late_cancelled_only', 'late_cancelled', 'sent_avbokade', 'cancelled_only'].includes(normalized)) {
		return 'late_cancelled_only';
	}
	return 'chargeable';
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
	const filters: PackageBookingReportFilters = {
		dateFrom: parseDate(url.searchParams.get('dateFrom')),
		dateTo: parseDate(url.searchParams.get('dateTo')),
		packageStatus: parsePackageStatus(url.searchParams.get('packageStatus')),
		cancellation: parseCancellation(url.searchParams.get('cancellation')),
		search: parseSearch(url.searchParams.get('search')),
		limit: parsePositiveInt(url.searchParams.get('limit')),
		offset: parsePositiveInt(url.searchParams.get('offset'))
	};

	try {
		const report = await getPackageBookingReport(filters);
		return json(report);
	} catch (error) {
		console.error('Failed to fetch package bookings report', error);
		return json({ error: 'Failed to fetch package bookings report' }, { status: 500 });
	}
};
