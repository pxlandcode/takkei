import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import {
	getClientDeleteImpact,
	ProfileLifecycleError,
	withProfileLifecycleTransaction
} from '$lib/server/profileLifecycle';

export const GET: RequestHandler = async ({ params, locals }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	const clientId = Number(params.slug);
	if (!Number.isFinite(clientId) || clientId <= 0) {
		return json({ error: 'Ogiltigt klient-id' }, { status: 400 });
	}

	try {
		const impact = await withProfileLifecycleTransaction((client) =>
			getClientDeleteImpact(client, clientId)
		);
		return json(impact);
	} catch (error) {
		if (error instanceof ProfileLifecycleError) {
			return json({ error: error.message, code: error.code }, { status: error.status });
		}

		console.error('Error fetching client delete impact:', error);
		return json({ error: 'Kunde inte hämta borttagningsinformation' }, { status: 500 });
	}
};
