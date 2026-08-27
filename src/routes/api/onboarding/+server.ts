import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import { listSignupOnboardingCases } from '$lib/server/signupOnboarding';
import { json, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ locals, url }) => {
	const admin = await resolveAdministratorRequest(locals);
	if (!admin.ok) return json({ error: admin.message }, { status: admin.status });

	try {
		return json(
			await listSignupOnboardingCases({
				status: url.searchParams.get('status'),
				search: url.searchParams.get('search'),
				limit: Number(url.searchParams.get('limit') ?? 50),
				offset: Number(url.searchParams.get('offset') ?? 0)
			})
		);
	} catch (error) {
		console.error('Failed to list onboarding cases:', error);
		return json({ error: 'Kunde inte hämta nya registreringar' }, { status: 500 });
	}
};
