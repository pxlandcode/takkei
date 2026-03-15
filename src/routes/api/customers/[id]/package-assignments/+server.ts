import { json, type RequestEvent } from '@sveltejs/kit';
import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import { loadPackageAssignmentWorkspace } from '$lib/server/packageAssignmentWorkspace';

export async function GET({ params, locals }: RequestEvent) {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) {
		return json({ error: admin.message }, { status: admin.status });
	}

	const customerId = Number(params.id);
	if (!Number.isInteger(customerId) || customerId <= 0) {
		return json({ error: 'Invalid customer id' }, { status: 400 });
	}

	try {
		const workspace = await loadPackageAssignmentWorkspace({
			scope: 'customer',
			scopeId: customerId
		});
		return json(workspace);
	} catch (error) {
		const message = (error as Error)?.message || 'Failed to load package assignments';
		const status = message === 'Customer not found' ? 404 : 500;
		console.error('Failed to load customer package assignment workspace:', error);
		return json({ error: message }, { status });
	}
}
