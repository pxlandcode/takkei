import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import { getSignupOnboardingSummary } from '$lib/server/signupOnboarding';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) return json({ error: admin.message }, { status: admin.status });

	try {
		return json(await getSignupOnboardingSummary(admin.authUser));
	} catch (error) {
		console.error('Failed to load onboarding summary:', error);
		return json({ error: 'Kunde inte hämta nya registreringar' }, { status: 500 });
	}
};
