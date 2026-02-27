import { type RequestHandler } from '@sveltejs/kit';
import {
	buildPackageBookingReportWorkbook,
	type PackageBookingReportCancellation,
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

export const GET: RequestHandler = async ({ url }) => {
	const filters = {
		dateFrom: parseDate(url.searchParams.get('dateFrom')),
		dateTo: parseDate(url.searchParams.get('dateTo')),
		packageStatus: parsePackageStatus(url.searchParams.get('packageStatus')),
		cancellation: parseCancellation(url.searchParams.get('cancellation')),
		search: parseSearch(url.searchParams.get('search'))
	};

	try {
		const { buffer, filename } = await buildPackageBookingReportWorkbook(filters);
		return new Response(buffer, {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (error) {
		console.error('Failed to export package bookings report', error);
		return new Response('Failed to export package bookings report', { status: 500 });
	}
};
