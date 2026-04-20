import { json, type RequestHandler } from '@sveltejs/kit';
import { respondJsonWithEtag } from '$lib/server/http-cache';
import {
	StandbyHttpError,
	createStandbyTime,
	listStandbyTimesForViewer,
	resolveTrainerIdFromLocalsUser
} from '$lib/server/standbyTimes';

function requireTrainerId(locals: App.Locals) {
	const trainerId = resolveTrainerIdFromLocalsUser(locals.user ?? null);
	if (!trainerId) {
		throw new StandbyHttpError(403, 'Forbidden', {
			general: 'Endast tränare kan hantera standbytid.'
		});
	}
	return trainerId;
}

export const GET: RequestHandler = async ({ url, locals, request }) => {
	try {
		const trainerId = requireTrainerId(locals);
		const showAll = url.searchParams.get('showAll') === 'true';
		const rows = await listStandbyTimesForViewer(trainerId, showAll);
		return respondJsonWithEtag(request, rows);
	} catch (error) {
		if (error instanceof StandbyHttpError) {
			return json({ error: error.message, errors: error.errors }, { status: error.status });
		}
		console.error('Error fetching standby times', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const trainerId = requireTrainerId(locals);
		const body = await request.json();
		const result = await createStandbyTime(trainerId, body);
		return json(result, { status: 201 });
	} catch (error) {
		if (error instanceof StandbyHttpError) {
			return json({ error: error.message, errors: error.errors }, { status: error.status });
		}
		console.error('Error creating standby time', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
