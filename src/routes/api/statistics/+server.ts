import { json } from '@sveltejs/kit';
import { getTrainerStatisticsService } from '$lib/services/api/statistics/trainerStatisticsService';
import { respondJsonWithEtag } from '$lib/server/http-cache';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, request }) => {
	const trainerIdParam = url.searchParams.get('trainerId');
	const trainerId = trainerIdParam ? Number(trainerIdParam) : NaN;

	if (!Number.isFinite(trainerId) || trainerId <= 0) {
		return json({ error: 'Invalid trainerId parameter' }, { status: 400 });
	}

	const from = url.searchParams.get('from') ?? undefined;
	const to = url.searchParams.get('to') ?? undefined;

	try {
		const result = await getTrainerStatisticsService({ trainerId, from, to });
		return respondJsonWithEtag(request, result);
	} catch (error) {
		console.error('Failed to compute trainer statistics', {
			trainerId,
			from,
			to,
			error
		});
		return json({ error: 'Failed to compute statistics' }, { status: 500 });
	}
};
