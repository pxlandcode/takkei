import { wrapFetch } from '$lib/services/api/apiCache';

export async function fetchTargetsAggregate(params: {
	year: number;
	trainerIds?: number[];
	locationIds?: number[];
	years?: number[];
}) {
	const fetcher = wrapFetch(fetch);
	const qs = new URLSearchParams();
	qs.set('year', String(params.year));
	if (params.trainerIds?.length) qs.set('trainerIds', params.trainerIds.join(','));
	if (params.locationIds?.length) qs.set('locationIds', params.locationIds.join(','));
	if (params.years?.length) qs.set('years', params.years.join(','));

	const res = await fetcher(`/api/targets/aggregate?${qs.toString()}`);
	if (!res.ok) throw new Error('Failed to fetch aggregate targets');

	return res.json() as Promise<{
		year: number;
		months: Array<{
			month: number;
			trainers: { goal: number; achieved: number };
			locations: { goal: number; achieved: number };
			combined: { goal: number; achieved: number };
		}>;
		yearTotals: Array<{
			year: number;
			trainers: { goal: number; achieved: number };
			locations: { goal: number; achieved: number };
			combined: { goal: number; achieved: number };
		}>;
		selection: { trainerIds: number[]; locationIds: number[] };
	}>;
}
