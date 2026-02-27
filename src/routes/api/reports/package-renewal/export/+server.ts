import { type RequestHandler } from '@sveltejs/kit';
import {
	buildPackageRenewalWorkbook,
	type PackageRenewalCapacityFilter,
	type PackageRenewalClientFilter,
	type PackageRenewalFrozenFilter,
	type PackageRenewalPriorityFilter
} from '$lib/services/api/reports/packageRenewal';

function parsePriority(value: string | null): PackageRenewalPriorityFilter {
	if (!value) return 'attention';
	const normalized = value.toLowerCase();
	if (normalized === 'all') return 'all';
	if (normalized === 'urgent') return 'urgent';
	if (normalized === 'watch') return 'watch';
	if (normalized === 'ok') return 'ok';
	return 'attention';
}

function parseCapacity(value: string | null): PackageRenewalCapacityFilter {
	if (!value) return 'all';
	const normalized = value.toLowerCase();
	if (normalized === 'full') return 'full';
	if (normalized === 'near_full' || normalized === 'near-full') return 'near_full';
	if (normalized === 'open') return 'open';
	return 'all';
}

function parseClient(value: string | null): PackageRenewalClientFilter {
	if (!value) return 'active';
	const normalized = value.toLowerCase();
	if (normalized === 'all') return 'all';
	if (normalized === 'inactive') return 'inactive';
	return 'active';
}

function parseFrozen(value: string | null): PackageRenewalFrozenFilter {
	if (!value) return 'exclude_frozen';
	const normalized = value.toLowerCase();
	if (normalized === 'all') return 'all';
	if (normalized === 'only_frozen' || normalized === 'only-frozen') return 'only_frozen';
	return 'exclude_frozen';
}

function parseOptionalId(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
	return parsed;
}

function parsePositiveInt(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) return undefined;
	return parsed;
}

function parseSearch(value: string | null): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : undefined;
}

export const GET: RequestHandler = async ({ url }) => {
	const filters = {
		priority: parsePriority(url.searchParams.get('priority')),
		capacity: parseCapacity(url.searchParams.get('capacity')),
		client: parseClient(url.searchParams.get('client')),
		frozen: parseFrozen(url.searchParams.get('frozen')),
		trainerId: parseOptionalId(url.searchParams.get('trainerId')),
		locationId: parseOptionalId(url.searchParams.get('locationId')),
		nearFullThreshold: parsePositiveInt(url.searchParams.get('nearFullThreshold')),
		closeToLastBookingDays: parsePositiveInt(url.searchParams.get('closeToLastBookingDays')),
		search: parseSearch(url.searchParams.get('search'))
	};

	try {
		const { buffer, filename } = await buildPackageRenewalWorkbook(filters);
		return new Response(buffer, {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (error) {
		console.error('Failed to export package renewal report', error);
		return new Response('Failed to export package renewal report', { status: 500 });
	}
};
