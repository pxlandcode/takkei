import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db', () => ({
	query: vi.fn()
}));

import { query } from '$lib/db';
import {
	assertPackageOwnerProfilesNotGdprDeleted,
	assertProfileNotGdprDeleted,
	assertProfilesNotGdprDeleted,
	ProfileLifecycleGuardError
} from './profileLifecycleGuards';

const mockedQuery = vi.mocked(query);

describe('profileLifecycleGuards', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('allows profiles that exist and are not GDPR deleted', async () => {
		mockedQuery.mockResolvedValue([{ id: 123, gdpr_deleted_at: null }]);

		await expect(assertProfileNotGdprDeleted('client', 123)).resolves.toBeUndefined();
	});

	it('rejects a GDPR deleted profile', async () => {
		mockedQuery.mockResolvedValue([{ id: 123, gdpr_deleted_at: '2026-07-31T10:00:00Z' }]);

		await expect(assertProfileNotGdprDeleted('client', 123)).rejects.toMatchObject({
			status: 409,
			code: 'profile_gdpr_deleted',
			message: 'Klienten är GDPR-raderad och kan inte ändras.'
		});
	});

	it('rejects missing profiles', async () => {
		mockedQuery.mockResolvedValue([]);

		await expect(assertProfileNotGdprDeleted('customer', 999)).rejects.toMatchObject({
			status: 404,
			code: 'customer_not_found',
			message: 'Kunden hittades inte.'
		});
	});

	it('rejects a deleted profile in a batch', async () => {
		mockedQuery.mockResolvedValue([
			{ id: 1, gdpr_deleted_at: null },
			{ id: 2, gdpr_deleted_at: '2026-07-31T10:00:00Z' }
		]);

		await expect(assertProfilesNotGdprDeleted('client', [1, 2])).rejects.toBeInstanceOf(
			ProfileLifecycleGuardError
		);
		await expect(assertProfilesNotGdprDeleted('client', [1, 2])).rejects.toMatchObject({
			status: 409,
			code: 'profile_gdpr_deleted'
		});
	});

	it('checks both package owner profiles when customer and client are provided', async () => {
		mockedQuery
			.mockResolvedValueOnce([{ id: 1, gdpr_deleted_at: null }])
			.mockResolvedValueOnce([{ id: 2, gdpr_deleted_at: null }]);

		await expect(
			assertPackageOwnerProfilesNotGdprDeleted({ customerId: 1, clientId: 2 })
		).resolves.toBeUndefined();

		expect(mockedQuery).toHaveBeenCalledTimes(2);
	});
});
