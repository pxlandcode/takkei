import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClient = {
	query: vi.fn(),
	release: vi.fn()
};

vi.mock('$lib/db', () => ({
	pool: { connect: vi.fn() },
	query: vi.fn(),
	queryWithClient: vi.fn()
}));

vi.mock('$lib/server/profileLifecycle', () => ({
	mergeClientProfiles: vi.fn(),
	mergeCustomerProfiles: vi.fn(),
	ProfileLifecycleError: class ProfileLifecycleError extends Error {}
}));

import * as db from '$lib/db';
import { mergeClientProfiles } from '$lib/server/profileLifecycle';
import { getSignupOnboardingSummary, performSignupOnboardingAction } from './signupOnboarding';

const mockedPool = db.pool as unknown as { connect: ReturnType<typeof vi.fn> };
const mockedQuery = vi.mocked(db.query);
const mockedMergeClientProfiles = vi.mocked(mergeClientProfiles);
const mockedTxQuery = vi.mocked(
	(db as unknown as { queryWithClient: (...args: any[]) => Promise<any[]> }).queryWithClient
);

function resolvedCase(overrides: Record<string, unknown> = {}) {
	return {
		id: 12,
		status: 'in_progress',
		submitted_payload: { firstname: 'Anna', lastname: 'Andersson', email: 'anna@example.com' },
		provisional_client_id: 20,
		provisional_customer_id: 30,
		provisional_package_id: 40,
		resolved_client_id: 20,
		resolved_customer_id: 30,
		resolved_package_id: 40,
		client_resolution: 'confirmed_new',
		customer_resolution: 'kept',
		package_resolution: 'kept',
		primary_assignment_resolution: 'selected',
		updated_at: '2026-08-26T12:00:00.000Z',
		...overrides
	};
}

function mockCaseReload(caseRow: any) {
	mockedQuery.mockImplementation(async (sql: string) => {
		if (sql.includes('FROM signup_onboarding_cases soc')) return [caseRow] as any;
		return [] as any;
	});
}

describe('signup onboarding service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockedPool.connect.mockResolvedValue(mockClient);
		mockClient.query.mockResolvedValue({ rows: [] });
		mockedMergeClientProfiles.mockResolvedValue({
			entity: 'client',
			id: 20,
			action: 'merged',
			targetId: 99
		});
	});

	it('counts every unresolved status', async () => {
		mockedQuery.mockResolvedValueOnce([{ pending: 7 }] as any);
		await expect(getSignupOnboardingSummary({ kind: 'trainer', trainerId: 9 })).resolves.toEqual({
			pending: 7
		});
		expect(mockedQuery.mock.calls[0][0]).toContain("status IN ('new', 'in_progress', 'waiting')");
		expect(mockedQuery.mock.calls[0][1]).toBeUndefined();
	});

	it('updates a case under a row lock and writes an audit action', async () => {
		const caseRow = resolvedCase({ status: 'new' });
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('FOR UPDATE')) return [caseRow] as any;
			return [] as any;
		});
		mockCaseReload({ ...caseRow, status: 'in_progress' });

		const result = await performSignupOnboardingAction({
			caseId: 12,
			action: {
				type: 'confirm_new_client',
				expectedUpdatedAt: caseRow.updated_at
			},
			authUser: { kind: 'trainer', trainerId: 9 }
		});

		expect(result.case.status).toBe('in_progress');
		expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
		expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
		expect(
			mockedTxQuery.mock.calls.some(([, sql]) =>
				String(sql).includes('INSERT INTO signup_onboarding_actions')
			)
		).toBe(true);
	});

	it('updates submitted client details and the self-paying customer atomically', async () => {
		const caseRow = resolvedCase({
			status: 'new',
			client_resolution: 'pending',
			customer_resolution: 'pending',
			submitted_payload: { paymentChoice: 'self' }
		});
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('FOR UPDATE')) return [caseRow] as any;
			return [] as any;
		});
		mockCaseReload({
			...caseRow,
			status: 'in_progress',
			submitted_payload: { paymentChoice: 'self', firstname: 'Annika' }
		});

		const result = await performSignupOnboardingAction({
			caseId: 12,
			action: {
				type: 'update_details',
				expectedUpdatedAt: caseRow.updated_at,
				details: {
					firstname: 'Annika',
					lastname: 'Andersson',
					email: 'ANNIKA@example.com',
					person_number: '800101-1234',
					phone: '0701234567',
					streetAddress: 'Testgatan 1',
					zip: '123 45',
					city: 'Stockholm'
				}
			},
			authUser: { kind: 'trainer', trainerId: 9 }
		});

		expect(result.case.submitted_payload.firstname).toBe('Annika');
		expect(
			mockedTxQuery.mock.calls.some(([, sql]) => String(sql).includes('UPDATE clients SET'))
		).toBe(true);
		expect(
			mockedTxQuery.mock.calls.some(([, sql]) => String(sql).includes('UPDATE customers SET'))
		).toBe(true);
		expect(
			mockedTxQuery.mock.calls.some(([, sql]) =>
				String(sql).includes('submitted_payload = submitted_payload ||')
			)
		).toBe(true);
		expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
	});

	it('rejects a stale action before writing changes or audit history', async () => {
		const caseRow = resolvedCase({ updated_at: '2026-08-26T12:05:00.000Z' });
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('FOR UPDATE')) return [caseRow] as any;
			return [] as any;
		});

		await expect(
			performSignupOnboardingAction({
				caseId: 12,
				action: {
					type: 'keep_customer',
					expectedUpdatedAt: '2026-08-26T12:00:00.000Z'
				},
				authUser: { kind: 'trainer', trainerId: 9 }
			})
		).rejects.toMatchObject({ status: 409, code: 'case_changed' });

		expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
		expect(
			mockedTxQuery.mock.calls.some(([, sql]) =>
				String(sql).includes('INSERT INTO signup_onboarding_actions')
			)
		).toBe(false);
	});

	it('marks a new case as in progress when a later step is changed', async () => {
		const caseRow = resolvedCase({
			status: 'new',
			customer_resolution: 'pending',
			package_resolution: 'pending'
		});
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('SELECT * FROM signup_onboarding_cases') && sql.includes('FOR UPDATE')) {
				return [caseRow] as any;
			}
			if (sql.includes('SELECT * FROM signup_onboarding_cases')) {
				return [
					{
						...caseRow,
						status: 'in_progress',
						customer_resolution: 'kept'
					}
				] as any;
			}
			return [] as any;
		});
		mockCaseReload({
			...caseRow,
			status: 'in_progress',
			customer_resolution: 'kept'
		});

		const result = await performSignupOnboardingAction({
			caseId: 12,
			action: {
				type: 'keep_customer',
				expectedUpdatedAt: caseRow.updated_at
			},
			authUser: { kind: 'trainer', trainerId: 9 }
		});

		expect(result.case.status).toBe('in_progress');
		expect(
			mockedTxQuery.mock.calls.some(([, sql]) => String(sql).includes("SET status = 'in_progress'"))
		).toBe(true);
	});

	it('rejects resolving later steps before the client step is resolved', async () => {
		const caseRow = resolvedCase({
			client_resolution: 'pending'
		});
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('FOR UPDATE')) return [caseRow] as any;
			return [] as any;
		});

		await expect(
			performSignupOnboardingAction({
				caseId: 12,
				action: {
					type: 'keep_customer',
					expectedUpdatedAt: caseRow.updated_at
				},
				authUser: { kind: 'trainer', trainerId: 9 }
			})
		).rejects.toMatchObject({
			status: 409,
			code: 'client_resolution_required'
		});
		expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
		expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
	});

	it('allows changing the selected package to another valid customer package', async () => {
		const caseRow = resolvedCase({
			provisional_package_id: 40,
			resolved_package_id: 40,
			package_resolution: 'kept'
		});
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('SELECT * FROM signup_onboarding_cases')) return [caseRow] as any;
			if (sql.includes('WHERE p.id = $1')) {
				return [{ id: 99, customer_id: 30, client_id: 20, remaining_sessions: 5 }] as any;
			}
			if (sql.includes('SELECT id FROM client_customer_relationships')) {
				return [{ id: 77 }] as any;
			}
			return [] as any;
		});
		mockCaseReload({
			...caseRow,
			resolved_package_id: 99,
			package_resolution: 'connected'
		});

		const result = await performSignupOnboardingAction({
			caseId: 12,
			action: {
				type: 'connect_package',
				packageId: 99,
				expectedUpdatedAt: caseRow.updated_at
			},
			authUser: { kind: 'trainer', trainerId: 9 }
		});

		expect(result.case.resolved_package_id).toBe(99);
		expect(
			mockedTxQuery.mock.calls.some(([, sql, params]) => {
				const values = params as unknown[] | undefined;
				return (
					String(sql).includes('package_resolution = $3') &&
					values?.[1] === 99 &&
					values?.[2] === 'connected'
				);
			})
		).toBe(true);
		expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
	});

	it('rejects selecting a fully booked package', async () => {
		const caseRow = resolvedCase({
			package_resolution: 'pending',
			resolved_package_id: null
		});
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('SELECT * FROM signup_onboarding_cases') && sql.includes('FOR UPDATE')) {
				return [caseRow] as any;
			}
			if (sql.includes('WHERE p.id = $1')) {
				return [{ id: 99, customer_id: 30, client_id: 20, remaining_sessions: 0 }] as any;
			}
			return [] as any;
		});

		await expect(
			performSignupOnboardingAction({
				caseId: 12,
				action: {
					type: 'connect_package',
					packageId: 99,
					expectedUpdatedAt: caseRow.updated_at
				},
				authUser: { kind: 'trainer', trainerId: 9 }
			})
		).rejects.toMatchObject({
			status: 409,
			code: 'package_fully_booked'
		});
		expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
		expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
	});

	it('auto-completes the case when the final required resolution is saved', async () => {
		const caseRow = resolvedCase({
			package_resolution: 'pending',
			resolved_package_id: null
		});
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('SELECT * FROM signup_onboarding_cases') && sql.includes('FOR UPDATE')) {
				return [caseRow] as any;
			}
			if (sql.includes('WHERE p.id = $1')) {
				return [{ id: 99, customer_id: 30, client_id: 20, remaining_sessions: 5 }] as any;
			}
			if (sql.includes('SELECT id FROM client_customer_relationships')) {
				return [{ id: 77 }] as any;
			}
			if (sql.includes('SELECT * FROM signup_onboarding_cases')) {
				return [
					{
						...caseRow,
						resolved_package_id: 99,
						package_resolution: 'connected'
					}
				] as any;
			}
			return [] as any;
		});
		mockCaseReload({
			...caseRow,
			status: 'completed',
			resolved_package_id: 99,
			package_resolution: 'connected',
			completed_at: new Date().toISOString()
		});

		const result = await performSignupOnboardingAction({
			caseId: 12,
			action: {
				type: 'connect_package',
				packageId: 99,
				expectedUpdatedAt: caseRow.updated_at
			},
			authUser: { kind: 'trainer', trainerId: 9 }
		});

		expect(result.case.status).toBe('completed');
		expect(
			mockedTxQuery.mock.calls.some(([, sql]) => String(sql).includes("SET status = 'completed'"))
		).toBe(true);
	});

	it('allows completing without a package when the customer has no usable package', async () => {
		const caseRow = resolvedCase({
			provisional_package_id: null,
			resolved_package_id: null,
			package_resolution: 'pending'
		});
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('SELECT * FROM signup_onboarding_cases') && sql.includes('FOR UPDATE')) {
				return [caseRow] as any;
			}
			if (sql.includes('FROM packages p')) return [] as any;
			if (sql.includes('SELECT * FROM signup_onboarding_cases')) {
				return [
					{
						...caseRow,
						package_resolution: 'not_required'
					}
				] as any;
			}
			return [] as any;
		});
		mockCaseReload({
			...caseRow,
			status: 'completed',
			package_resolution: 'not_required',
			completed_at: new Date().toISOString()
		});

		const result = await performSignupOnboardingAction({
			caseId: 12,
			action: {
				type: 'skip_package',
				expectedUpdatedAt: caseRow.updated_at
			},
			authUser: { kind: 'trainer', trainerId: 9 }
		});

		expect(result.case.status).toBe('completed');
		expect(result.case.package_resolution).toBe('not_required');
		expect(result.case.resolved_package_id).toBeNull();
		expect(
			mockedTxQuery.mock.calls.some(([, sql]) =>
				String(sql).includes("package_resolution = 'not_required'")
			)
		).toBe(true);
	});

	it('rejects skipping the package step when a usable package exists', async () => {
		const caseRow = resolvedCase({
			provisional_package_id: null,
			resolved_package_id: null,
			package_resolution: 'pending'
		});
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('SELECT * FROM signup_onboarding_cases') && sql.includes('FOR UPDATE')) {
				return [caseRow] as any;
			}
			if (sql.includes('FROM packages p')) return [{ id: 99 }] as any;
			return [] as any;
		});

		await expect(
			performSignupOnboardingAction({
				caseId: 12,
				action: {
					type: 'skip_package',
					expectedUpdatedAt: caseRow.updated_at
				},
				authUser: { kind: 'trainer', trainerId: 9 }
			})
		).rejects.toMatchObject({
			status: 409,
			code: 'package_available'
		});
		expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
		expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
	});

	it('saves primary trainer and location before completing the case', async () => {
		const caseRow = resolvedCase({
			primary_assignment_resolution: 'pending'
		});
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('SELECT * FROM signup_onboarding_cases') && sql.includes('FOR UPDATE')) {
				return [caseRow] as any;
			}
			if (sql.includes('SELECT id FROM users')) return [{ id: 9 }] as any;
			if (sql.includes('SELECT id FROM locations')) return [{ id: 3 }] as any;
			if (sql.includes('SELECT * FROM signup_onboarding_cases')) {
				return [
					{
						...caseRow,
						primary_assignment_resolution: 'selected'
					}
				] as any;
			}
			return [] as any;
		});
		mockCaseReload({
			...caseRow,
			status: 'completed',
			primary_assignment_resolution: 'selected',
			completed_at: new Date().toISOString()
		});

		const result = await performSignupOnboardingAction({
			caseId: 12,
			action: {
				type: 'set_primary_assignment',
				primaryTrainerId: 9,
				primaryLocationId: 3,
				expectedUpdatedAt: caseRow.updated_at
			},
			authUser: { kind: 'trainer', trainerId: 9 }
		});

		expect(result.case.status).toBe('completed');
		expect(
			mockedTxQuery.mock.calls.some(([, sql, params]) => {
				const values = params as unknown[] | undefined;
				return (
					String(sql).includes('UPDATE clients') &&
					String(sql).includes('primary_trainer_id') &&
					values?.[0] === 20 &&
					values?.[1] === 9 &&
					values?.[2] === 3
				);
			})
		).toBe(true);
	});

	it('allows actively skipping primary trainer and location', async () => {
		const caseRow = resolvedCase({
			primary_assignment_resolution: 'pending'
		});
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('SELECT * FROM signup_onboarding_cases') && sql.includes('FOR UPDATE')) {
				return [caseRow] as any;
			}
			if (sql.includes('SELECT * FROM signup_onboarding_cases')) {
				return [
					{
						...caseRow,
						primary_assignment_resolution: 'skipped'
					}
				] as any;
			}
			return [] as any;
		});
		mockCaseReload({
			...caseRow,
			status: 'completed',
			primary_assignment_resolution: 'skipped',
			completed_at: new Date().toISOString()
		});

		const result = await performSignupOnboardingAction({
			caseId: 12,
			action: {
				type: 'skip_primary_assignment',
				expectedUpdatedAt: caseRow.updated_at
			},
			authUser: { kind: 'trainer', trainerId: 9 }
		});

		expect(result.case.status).toBe('completed');
		expect(result.case.primary_assignment_resolution).toBe('skipped');
	});

	it('auto-keeps provisional customer and package after merging the signup client', async () => {
		const caseRow = resolvedCase({
			client_resolution: 'pending',
			customer_resolution: 'pending',
			package_resolution: 'pending'
		});
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('SELECT * FROM signup_onboarding_cases WHERE id = $1 FOR UPDATE')) {
				return [caseRow] as any;
			}
			if (sql.includes('SELECT id FROM client_customer_relationships')) return [] as any;
			if (sql.includes('WHERE p.id = $1')) {
				return [{ id: 40, customer_id: 30, client_id: 99, remaining_sessions: 5 }] as any;
			}
			return [] as any;
		});
		mockCaseReload({
			...caseRow,
			resolved_client_id: 99,
			client_resolution: 'merged',
			customer_resolution: 'kept',
			package_resolution: 'kept'
		});

		const result = await performSignupOnboardingAction({
			caseId: 12,
			action: {
				type: 'merge_client',
				targetClientId: 99,
				expectedUpdatedAt: caseRow.updated_at
			},
			authUser: { kind: 'trainer', trainerId: 9 }
		});

		expect(result.case.client_resolution).toBe('merged');
		expect(result.case.customer_resolution).toBe('kept');
		expect(result.case.package_resolution).toBe('kept');
		expect(
			mockedTxQuery.mock.calls.some(([, sql, params]) => {
				const values = params as unknown[] | undefined;
				return (
					String(sql).includes('customer_resolution = CASE') &&
					values?.[1] === 99 &&
					values?.[2] === 30 &&
					values?.[3] === 'kept' &&
					values?.[4] === 40 &&
					values?.[5] === 'kept'
				);
			})
		).toBe(true);
	});

	it('auto-connects one existing customer and package after merging into an existing client', async () => {
		const caseRow = resolvedCase({
			client_resolution: 'pending',
			customer_resolution: 'pending',
			package_resolution: 'pending',
			provisional_customer_id: null,
			provisional_package_id: null,
			resolved_customer_id: null,
			resolved_package_id: null
		});
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('SELECT * FROM signup_onboarding_cases WHERE id = $1 FOR UPDATE')) {
				return [caseRow] as any;
			}
			if (sql.includes('FROM client_customer_relationships rel')) {
				return [{ customer_id: 55 }] as any;
			}
			if (sql.includes('FROM packages p')) {
				return [{ id: 66 }] as any;
			}
			return [] as any;
		});
		mockCaseReload({
			...caseRow,
			resolved_client_id: 99,
			resolved_customer_id: 55,
			resolved_package_id: 66,
			client_resolution: 'merged',
			customer_resolution: 'connected',
			package_resolution: 'connected'
		});

		const result = await performSignupOnboardingAction({
			caseId: 12,
			action: {
				type: 'merge_client',
				targetClientId: 99,
				expectedUpdatedAt: caseRow.updated_at
			},
			authUser: { kind: 'trainer', trainerId: 9 }
		});

		expect(result.case.resolved_customer_id).toBe(55);
		expect(result.case.resolved_package_id).toBe(66);
		expect(result.case.customer_resolution).toBe('connected');
		expect(result.case.package_resolution).toBe('connected');
	});

	it('rejects completion while a required resolution is pending', async () => {
		const caseRow = resolvedCase({ client_resolution: 'pending' });
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('SELECT * FROM signup_onboarding_cases')) return [caseRow] as any;
			return [] as any;
		});

		await expect(
			performSignupOnboardingAction({
				caseId: 12,
				action: { type: 'complete', expectedUpdatedAt: caseRow.updated_at },
				authUser: { kind: 'trainer', trainerId: 9 }
			})
		).rejects.toMatchObject({
			status: 409,
			code: 'incomplete_case'
		});
		expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
		expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
	});

	it('completes a fully resolved case without requiring a booking', async () => {
		const caseRow = resolvedCase({ booking_id: null });
		mockedTxQuery.mockImplementation(async (_client, sql: string) => {
			if (sql.includes('SELECT * FROM signup_onboarding_cases')) return [caseRow] as any;
			return [] as any;
		});
		mockCaseReload({ ...caseRow, status: 'completed', completed_at: new Date().toISOString() });

		const result = await performSignupOnboardingAction({
			caseId: 12,
			action: {
				type: 'complete',
				note: 'Klar',
				expectedUpdatedAt: caseRow.updated_at
			},
			authUser: { kind: 'trainer', trainerId: 9 }
		});

		expect(result.case.status).toBe('completed');
		expect(result.case.booking_id).toBeNull();
		expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
	});
});
