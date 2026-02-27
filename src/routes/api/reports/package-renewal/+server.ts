import { json, type RequestHandler } from '@sveltejs/kit';
import {
	getPackageRenewalReport,
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
		search: parseSearch(url.searchParams.get('search')),
		limit: parsePositiveInt(url.searchParams.get('limit')),
		offset: parsePositiveInt(url.searchParams.get('offset'))
	};

	try {
		const report = await getPackageRenewalReport(filters);
		return json(report);
	} catch (error) {
		console.error('Failed to fetch package renewal report', error);
		return json({ error: 'Failed to fetch package renewal report' }, { status: 500 });
	}
};
