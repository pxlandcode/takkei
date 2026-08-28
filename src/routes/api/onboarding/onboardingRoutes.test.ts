import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/adminAccess', () => ({
	resolveAdministratorRequest: vi.fn()
}));

vi.mock('$lib/server/signupOnboarding', () => ({
	getSignupOnboardingSummary: vi.fn(),
	listSignupOnboardingCases: vi.fn(),
	getSignupOnboardingCase: vi.fn(),
	performSignupOnboardingAction: vi.fn(),
	SignupOnboardingError: class SignupOnboardingError extends Error {}
}));

import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import {
	getSignupOnboardingSummary,
	listSignupOnboardingCases,
	performSignupOnboardingAction
} from '$lib/server/signupOnboarding';
import { GET as getSummary } from './summary/+server';
import { GET as listCases } from './+server';
import { POST as performAction } from './[id]/actions/+server';

const mockedAdmin = vi.mocked(resolveAdministratorRequest);
const mockedSummary = vi.mocked(getSignupOnboardingSummary);
const mockedList = vi.mocked(listSignupOnboardingCases);
const mockedAction = vi.mocked(performSignupOnboardingAction);

describe('/api/onboarding', () => {
	beforeEach(() => vi.clearAllMocks());

	it('rejects non-administrators', async () => {
		mockedAdmin.mockResolvedValue({ ok: false, status: 403, message: 'Forbidden' });
		const response = await getSummary({ locals: {} } as any);
		expect(response.status).toBe(403);
		expect(mockedSummary).not.toHaveBeenCalled();
	});

	it('returns the shared pending summary for administrators', async () => {
		const authUser = { id: 2, kind: 'trainer' };
		mockedAdmin.mockResolvedValue({ ok: true, authUser, roleAwareUser: authUser });
		mockedSummary.mockResolvedValue({ pending: 5 });
		const response = await getSummary({ locals: {} } as any);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ pending: 5 });
	});

	it('passes list filters to the onboarding service', async () => {
		const authUser = { id: 2, kind: 'trainer' };
		mockedAdmin.mockResolvedValue({ ok: true, authUser, roleAwareUser: authUser });
		mockedList.mockResolvedValue({ cases: [], total: 0 });
		const url = new URL('http://localhost/api/onboarding?search=Anna&limit=20');
		const response = await listCases({ locals: {}, url } as any);
		expect(response.status).toBe(200);
		expect(mockedList).toHaveBeenCalledWith(
			expect.objectContaining({ search: 'Anna', limit: 20 })
		);
		expect(mockedList.mock.calls[0][0]).not.toHaveProperty('authUser');
	});

	it('dispatches typed actions with the locked case id', async () => {
		const authUser = { id: 2, kind: 'trainer' };
		mockedAdmin.mockResolvedValue({ ok: true, authUser, roleAwareUser: authUser });
		mockedAction.mockResolvedValue({ case: { id: 12, status: 'in_progress' } } as any);
		const request = new Request('http://localhost/api/onboarding/12/actions', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				type: 'confirm_new_client',
				expectedUpdatedAt: '2026-08-26T12:00:00.000Z'
			})
		});
		const response = await performAction({ locals: {}, params: { id: '12' }, request } as any);
		expect(response.status).toBe(200);
		expect(mockedAction).toHaveBeenCalledWith({
			caseId: 12,
			action: {
				type: 'confirm_new_client',
				expectedUpdatedAt: '2026-08-26T12:00:00.000Z'
			},
			authUser
		});
	});
});
