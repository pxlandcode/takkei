import { json, type RequestEvent } from '@sveltejs/kit';
import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import { validateScopedPackageAssignmentChanges } from '$lib/server/packageAssignmentWorkspace';

export async function POST({ params, request, locals }: RequestEvent) {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	const clientId = Number(params.slug);
	if (!Number.isInteger(clientId) || clientId <= 0) {
		return json({ error: 'Invalid client id' }, { status: 400 });
	}

	let body: any = {};
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	try {
		const { validation } = await validateScopedPackageAssignmentChanges({
			scope: 'client',
			scopeId: clientId,
			changes: Array.isArray(body?.changes) ? body.changes : []
		});
		return json(validation);
	} catch (error) {
		const message = (error as Error)?.message || 'Failed to validate package assignments';
		const status = message === 'Client not found' ? 404 : 500;
		console.error('Failed to validate client package assignment changes:', error);
		return json({ error: message }, { status });
	}
}
