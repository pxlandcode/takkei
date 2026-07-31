import { json, type RequestHandler } from '@sveltejs/kit';
import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import {
	getClientMergePreview,
	mergeClientProfiles,
	ProfileLifecycleError,
	resolveLifecycleActorId,
	withProfileLifecycleTransaction
} from '$lib/server/profileLifecycle';

function parseTargetClientId(value: unknown) {
	const id = Number(value);
	return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	const sourceClientId = parseTargetClientId(params.slug);
	const targetClientId = parseTargetClientId(url.searchParams.get('targetClientId'));
	if (!sourceClientId || !targetClientId) {
		return json({ error: 'sourceClientId och targetClientId krävs' }, { status: 400 });
	}

	try {
		const preview = await withProfileLifecycleTransaction((client) =>
			getClientMergePreview({ client, sourceClientId, targetClientId })
		);
		return json(preview);
	} catch (error) {
		if (error instanceof ProfileLifecycleError) {
			return json({ error: error.message, code: error.code }, { status: error.status });
		}

		console.error('Error fetching client merge preview:', error);
		return json({ error: 'Kunde inte hämta sammanslagningsinformation' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	const sourceClientId = parseTargetClientId(params.slug);
	let body: any;
	try {
		body = await request.json();
	} catch {
		body = {};
	}
	const targetClientId = parseTargetClientId(body?.targetClientId);

	if (!sourceClientId || !targetClientId) {
		return json({ error: 'sourceClientId och targetClientId krävs' }, { status: 400 });
	}

	try {
		const result = await withProfileLifecycleTransaction((client) =>
			mergeClientProfiles({
				client,
				sourceClientId,
				targetClientId,
				actorUserId: resolveLifecycleActorId(admin.authUser)
			})
		);
		return json(result);
	} catch (error) {
		if (error instanceof ProfileLifecycleError) {
			return json({ error: error.message, code: error.code }, { status: error.status });
		}

		console.error('Error merging client profiles:', error);
		return json({ error: 'Kunde inte slå ihop klienterna' }, { status: 500 });
	}
};
