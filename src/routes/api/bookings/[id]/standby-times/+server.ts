import { json, type RequestHandler } from '@sveltejs/kit';
import { respondJsonWithEtag } from '$lib/server/http-cache';
import {
	StandbyHttpError,
	getMatchingStandbyTimesForBooking,
	resolveTrainerIdFromLocalsUser
} from '$lib/server/standbyTimes';

function requireTrainerId(locals: App.Locals) {
	const trainerId = resolveTrainerIdFromLocalsUser(locals.user ?? null);
	if (!trainerId) {
		throw new StandbyHttpError(403, 'Forbidden', {
			general: 'Endast tränare kan visa standbytid.'
		});
	}
	return trainerId;
}

export const GET: RequestHandler = async ({ params, locals, request }) => {
	try {
		const trainerId = requireTrainerId(locals);
		const bookingId = Number(params.id);
		if (!Number.isInteger(bookingId) || bookingId <= 0) {
			throw new StandbyHttpError(400, 'Ogiltigt boknings-ID', { general: 'Ogiltigt boknings-ID' });
		}

		const standbyTimes = await getMatchingStandbyTimesForBooking(bookingId, trainerId);
		return respondJsonWithEtag(request, standbyTimes);
	} catch (error) {
		if (error instanceof StandbyHttpError) {
			return json({ error: error.message, errors: error.errors }, { status: error.status });
		}
		console.error('Error fetching booking standby times', error);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
