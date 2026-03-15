import { json, type RequestEvent } from '@sveltejs/kit';
import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import { loadPackageAssignmentWorkspace } from '$lib/server/packageAssignmentWorkspace';

export async function GET({ params, locals }: RequestEvent) {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	const clientId = Number(params.slug);
	if (!Number.isInteger(clientId) || clientId <= 0) {
		return json({ error: 'Invalid client id' }, { status: 400 });
	}

	try {
		const workspace = await loadPackageAssignmentWorkspace({
			scope: 'client',
			scopeId: clientId
		});
		return json(workspace);
	} catch (error) {
		const message = (error as Error)?.message || 'Failed to load package assignments';
		const status = message === 'Client not found' ? 404 : 500;
		console.error('Failed to load client package assignment workspace:', error);
		return json({ error: message }, { status });
	}
}
