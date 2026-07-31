import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import {
	getCustomerDeleteImpact,
	ProfileLifecycleError,
	withProfileLifecycleTransaction
} from '$lib/server/profileLifecycle';

export const GET: RequestHandler = async ({ params, locals }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	const customerId = Number(params.id);
	if (!Number.isFinite(customerId) || customerId <= 0) {
		return json({ error: 'Ogiltigt kund-id' }, { status: 400 });
	}

	try {
		const impact = await withProfileLifecycleTransaction((client) =>
			getCustomerDeleteImpact(client, customerId)
		);
		return json(impact);
	} catch (error) {
		if (error instanceof ProfileLifecycleError) {
			return json({ error: error.message, code: error.code }, { status: error.status });
		}

		console.error('Error fetching customer delete impact:', error);
		return json({ error: 'Kunde inte hämta borttagningsinformation' }, { status: 500 });
	}
};
