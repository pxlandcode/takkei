import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import {
	getSignupOnboardingCase,
	SignupOnboardingError
} from '$lib/server/signupOnboarding';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals, params }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) return json({ error: admin.message }, { status: admin.status });
	const caseId = Number(params.id);
	if (!Number.isInteger(caseId) || caseId <= 0) {
		return json({ error: 'Ogiltigt registrerings-id' }, { status: 400 });
	}

	try {
		return json(await getSignupOnboardingCase(caseId));
	} catch (error) {
		if (error instanceof SignupOnboardingError) {
			return json({ error: error.message, code: error.code }, { status: error.status });
		}
		console.error('Failed to load onboarding case:', error);
		return json({ error: 'Kunde inte hämta registreringen' }, { status: 500 });
	}
};
