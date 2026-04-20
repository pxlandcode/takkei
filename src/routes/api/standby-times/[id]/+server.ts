import { json, type RequestHandler } from '@sveltejs/kit';
import { respondJsonWithEtag } from '$lib/server/http-cache';
import {
	StandbyHttpError,
	deleteStandbyTime,
	getStandbyTimeForViewer,
	resolveTrainerIdFromLocalsUser,
	updateStandbyTime
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

function parseId(idParam: string) {
	const id = Number(idParam);
	if (!Number.isInteger(id) || id <= 0) {
		throw new StandbyHttpError(400, 'Ogiltigt standby-ID', { general: 'Ogiltigt standby-ID' });
	}
	return id;
}

export const GET: RequestHandler = async ({ params, locals, request }) => {
	try {
		const trainerId = requireTrainerId(locals);
		const id = parseId(params.id ?? '');
		const standbyTime = await getStandbyTimeForViewer(id, trainerId);
		return respondJsonWithEtag(request, standbyTime);
	} catch (error) {
		if (error instanceof StandbyHttpError) {
			return json({ error: error.message, errors: error.errors }, { status: error.status });
		}
		console.error('Error fetching standby time', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	try {
		const trainerId = requireTrainerId(locals);
		const id = parseId(params.id ?? '');
		const body = await request.json();
		const result = await updateStandbyTime(id, trainerId, body);
		return json(result);
	} catch (error) {
		if (error instanceof StandbyHttpError) {
			return json({ error: error.message, errors: error.errors }, { status: error.status });
		}
		console.error('Error updating standby time', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const trainerId = requireTrainerId(locals);
		const id = parseId(params.id ?? '');
		await deleteStandbyTime(id, trainerId);
		return json({ success: true });
	} catch (error) {
		if (error instanceof StandbyHttpError) {
			return json({ error: error.message, errors: error.errors }, { status: error.status });
		}
		console.error('Error deleting standby time', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
