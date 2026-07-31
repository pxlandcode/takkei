import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db', () => ({
	pool: { connect: vi.fn() },
	query: vi.fn()
}));

vi.mock('$lib/server/auth', () => ({
	clientKeyId: vi.fn((email: string) => email.toLowerCase()),
	clientUserId: vi.fn((clientId: number) => `client:${clientId}`)
}));

vi.mock('$lib/server/adminAccess', () => ({
	resolveAdministratorRequest: vi.fn()
}));

vi.mock('$lib/server/profileLifecycle', () => ({
	ProfileLifecycleError: class ProfileLifecycleError extends Error {
		status: number;
		code: string;

		constructor(status: number, message: string, code = 'profile_lifecycle_error') {
			super(message);
			this.status = status;
			this.code = code;
		}
	},
	withProfileLifecycleTransaction: vi.fn(),
	resolveLifecycleActorId: vi.fn(),
	getClientDeleteImpact: vi.fn(),
	getCustomerDeleteImpact: vi.fn(),
	deleteClientProfile: vi.fn(),
	deleteCustomerProfile: vi.fn(),
	getClientMergePreview: vi.fn(),
	getCustomerMergePreview: vi.fn(),
	mergeClientProfiles: vi.fn(),
	mergeCustomerProfiles: vi.fn()
}));

import { resolveAdministratorRequest } from '$lib/server/adminAccess';
import { query } from '$lib/db';
import { DELETE as clientDelete, PUT as clientUpdate } from '../../routes/api/clients/[slug]/+server';
import { GET as clientDeleteImpact } from '../../routes/api/clients/[slug]/delete-impact/+server';
import {
	GET as clientMergePreview,
	POST as clientMerge
} from '../../routes/api/clients/[slug]/merge/+server';
import {
	DELETE as customerDelete,
	PATCH as customerUpdate
} from '../../routes/api/customers/[id]/+server';
import { GET as customerDeleteImpact } from '../../routes/api/customers/[id]/delete-impact/+server';
import {
	GET as customerMergePreview,
	POST as customerMerge
} from '../../routes/api/customers/[id]/merge/+server';
import {
	GET as clientPackageAssignments
} from '../../routes/api/clients/[slug]/package-assignments/+server';
import {
	POST as clientPackageAssignmentsValidate
} from '../../routes/api/clients/[slug]/package-assignments/validate/+server';
import {
	POST as clientPackageAssignmentsApply
} from '../../routes/api/clients/[slug]/package-assignments/apply/+server';
import {
	GET as customerPackageAssignments
} from '../../routes/api/customers/[id]/package-assignments/+server';
import {
	POST as customerPackageAssignmentsValidate
} from '../../routes/api/customers/[id]/package-assignments/validate/+server';
import {
	POST as customerPackageAssignmentsApply
} from '../../routes/api/customers/[id]/package-assignments/apply/+server';
import { PATCH as customerClientsUpdate } from '../../routes/api/customers/[id]/clients/+server';
import { POST as clientSaldoAdjustment } from '../../routes/api/clients/[slug]/saldojustering/+server';
import { GET as anonymizedProfiles } from '../../routes/api/settings/anonymized-profiles/+server';

const mockedResolveAdministratorRequest = vi.mocked(resolveAdministratorRequest);
const mockedQuery = vi.mocked(query);

type HandlerCase = {
	name: string;
	handler: (event: any) => Response | Promise<Response>;
	event: any;
};

function requestEvent(
	params: Record<string, string>,
	url = 'http://localhost/test',
	body: Record<string, unknown> = {}
): any {
	return {
		params,
		locals: {},
		url: new URL(url),
		request: new Request(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	};
}

const protectedEndpointCases: HandlerCase[] = [
	{
		name: 'client delete impact',
		handler: clientDeleteImpact,
		event: requestEvent({ slug: '123' })
	},
	{
		name: 'client delete',
		handler: clientDelete,
		event: requestEvent({ slug: '123' })
	},
	{
		name: 'client merge preview',
		handler: clientMergePreview,
		event: requestEvent({ slug: '123' }, 'http://localhost/test?targetClientId=124')
	},
	{
		name: 'client merge',
		handler: clientMerge,
		event: requestEvent({ slug: '123' })
	},
	{
		name: 'customer delete impact',
		handler: customerDeleteImpact,
		event: requestEvent({ id: '123' })
	},
	{
		name: 'customer delete',
		handler: customerDelete,
		event: requestEvent({ id: '123' })
	},
	{
		name: 'customer merge preview',
		handler: customerMergePreview,
		event: requestEvent({ id: '123' }, 'http://localhost/test?targetCustomerId=124')
	},
	{
		name: 'customer merge',
		handler: customerMerge,
		event: requestEvent({ id: '123' })
	},
	{
		name: 'customer clients update',
		handler: customerClientsUpdate,
		event: requestEvent({ id: '123' })
	},
	{
		name: 'client package assignment workspace',
		handler: clientPackageAssignments,
		event: requestEvent({ slug: '123' })
	},
	{
		name: 'client package assignment validate',
		handler: clientPackageAssignmentsValidate,
		event: requestEvent({ slug: '123' })
	},
	{
		name: 'client package assignment apply',
		handler: clientPackageAssignmentsApply,
		event: requestEvent({ slug: '123' })
	},
	{
		name: 'customer package assignment workspace',
		handler: customerPackageAssignments,
		event: requestEvent({ id: '123' })
	},
	{
		name: 'customer package assignment validate',
		handler: customerPackageAssignmentsValidate,
		event: requestEvent({ id: '123' })
	},
	{
		name: 'customer package assignment apply',
		handler: customerPackageAssignmentsApply,
		event: requestEvent({ id: '123' })
	},
	{
		name: 'client saldo adjustment',
		handler: clientSaldoAdjustment,
		event: requestEvent({ slug: '123' })
	},
	{
		name: 'anonymized profiles settings',
		handler: anonymizedProfiles,
		event: requestEvent({})
	}
];

describe('profile lifecycle API authorization', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.each(protectedEndpointCases)('rejects unauthenticated requests for $name', async ({ handler, event }) => {
		mockedResolveAdministratorRequest.mockResolvedValue({
			ok: false,
			status: 401,
			message: 'Unauthorized'
		});

		const response = await handler(event);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
	});

	it.each(protectedEndpointCases)('rejects non-admin requests for $name', async ({ handler, event }) => {
		mockedResolveAdministratorRequest.mockResolvedValue({
			ok: false,
			status: 403,
			message: 'Forbidden'
		});

		const response = await handler(event);

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({ error: 'Forbidden' });
	});

	it('rejects direct updates to a GDPR deleted client', async () => {
		mockedQuery.mockResolvedValue([{ id: 123, gdpr_deleted_at: '2026-07-31T10:00:00Z' }]);

		const response = await clientUpdate(requestEvent({ slug: '123' }));

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: 'Klienten är GDPR-raderad och kan inte ändras.',
			code: 'profile_gdpr_deleted'
		});
	});

	it('rejects direct updates to a GDPR deleted customer', async () => {
		mockedQuery.mockResolvedValue([{ id: 123, gdpr_deleted_at: '2026-07-31T10:00:00Z' }]);

		const response = await customerUpdate(requestEvent({ id: '123' }));

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: 'Kunden är GDPR-raderad och kan inte ändras.',
			code: 'profile_gdpr_deleted'
		});
	});

	it('rejects relationship updates for a GDPR deleted customer', async () => {
		mockedResolveAdministratorRequest.mockResolvedValue({
			ok: true,
			authUser: { kind: 'trainer', trainerId: 7 },
			roleAwareUser: { roles: ['Administrator'] }
		});
		mockedQuery.mockResolvedValue([{ id: 123, gdpr_deleted_at: '2026-07-31T10:00:00Z' }]);

		const response = await customerClientsUpdate(
			requestEvent({ id: '123' }, 'http://localhost/test', { clientIds: [] })
		);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			error: 'Kunden är GDPR-raderad och kan inte ändras.',
			code: 'profile_gdpr_deleted'
		});
	});
});
