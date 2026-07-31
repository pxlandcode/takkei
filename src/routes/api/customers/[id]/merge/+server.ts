import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import {
	getCustomerMergePreview,
	mergeCustomerProfiles,
	ProfileLifecycleError,
	resolveLifecycleActorId,
	withProfileLifecycleTransaction
} from '$lib/server/profileLifecycle';

function parseTargetCustomerId(value: unknown) {
	const id = Number(value);
	return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	const sourceCustomerId = parseTargetCustomerId(params.id);
	const targetCustomerId = parseTargetCustomerId(url.searchParams.get('targetCustomerId'));
	if (!sourceCustomerId || !targetCustomerId) {
		return json({ error: 'sourceCustomerId och targetCustomerId krävs' }, { status: 400 });
	}

	try {
		const preview = await withProfileLifecycleTransaction((client) =>
			getCustomerMergePreview({ client, sourceCustomerId, targetCustomerId })
		);
		return json(preview);
	} catch (error) {
		if (error instanceof ProfileLifecycleError) {
			return json({ error: error.message, code: error.code }, { status: error.status });
		}

		console.error('Error fetching customer merge preview:', error);
		return json({ error: 'Kunde inte hämta sammanslagningsinformation' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	const sourceCustomerId = parseTargetCustomerId(params.id);
	let body: any;
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	const targetCustomerId = parseTargetCustomerId(body?.targetCustomerId);

	if (!sourceCustomerId || !targetCustomerId) {
		return json({ error: 'sourceCustomerId och targetCustomerId krävs' }, { status: 400 });
	}

	try {
		const result = await withProfileLifecycleTransaction((client) =>
			mergeCustomerProfiles({
				client,
				sourceCustomerId,
				targetCustomerId,
				actorUserId: resolveLifecycleActorId(admin.authUser)
			})
		);
		return json(result);
	} catch (error) {
		if (error instanceof ProfileLifecycleError) {
			return json({ error: error.message, code: error.code }, { status: error.status });
		}

		console.error('Error merging customer profiles:', error);
		return json({ error: 'Kunde inte slå ihop kunderna' }, { status: 500 });
	}
};
