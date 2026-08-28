import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import {
	performSignupOnboardingAction,
	SignupOnboardingError
} from '$lib/server/signupOnboarding';
import { ProfileLifecycleError } from '$lib/server/profileLifecycle';
import type { SignupOnboardingAction } from '$lib/types/signupOnboarding';
import { json, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) return json({ error: admin.message }, { status: admin.status });
	const caseId = Number(params.id);
	if (!Number.isInteger(caseId) || caseId <= 0) {
		return json({ error: 'Ogiltigt registrerings-id' }, { status: 400 });
	}

	let action: SignupOnboardingAction;
	try {
		action = (await request.json()) as SignupOnboardingAction;
	} catch {
		return json({ error: 'Ogiltig kropp' }, { status: 400 });
	}

	try {
		return json(
			await performSignupOnboardingAction({ caseId, action, authUser: admin.authUser })
		);
	} catch (error) {
		if (error instanceof SignupOnboardingError || error instanceof ProfileLifecycleError) {
			return json(
				{ error: error.message, code: 'code' in error ? error.code : 'lifecycle_error' },
				{ status: error.status }
			);
		}
		console.error('Failed to perform onboarding action:', error);
		return json({ error: 'Kunde inte uppdatera registreringen' }, { status: 500 });
	}
};
