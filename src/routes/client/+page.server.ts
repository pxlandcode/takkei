import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const authUser = locals.user;

	if (!authUser) {
		throw redirect(302, '/login');
	}

	if (authUser.kind !== 'client') {
		throw redirect(303, '/');
	}

	const clientId = authUser.clientId ?? authUser.client_id ?? null;

	if (!clientId) {
		throw redirect(302, '/login');
	}

	const clientResponse = await fetch(`/api/clients/${clientId}`);

	if (!clientResponse.ok) {
		throw error(clientResponse.status, 'Kunde inte hämta klientprofil.');
	}

	const client = await clientResponse.json();

	return {
		client
	};
};
