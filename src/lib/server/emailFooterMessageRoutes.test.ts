import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db', () => ({
	query: vi.fn()
}));

import { query } from '$lib/db';
import { GET, POST } from '../../routes/api/settings/email-footer-messages/+server';
import { DELETE, PATCH } from '../../routes/api/settings/email-footer-messages/[id]/+server';

const mockedQuery = vi.mocked(query);

const adminLocals = {
	user: {
		kind: 'trainer',
		trainerId: 1,
		roles: ['Administrator']
	}
};

const clientLocals = {
	user: {
		kind: 'client',
		clientId: 1,
		roles: []
	}
};

function jsonRequest(body: Record<string, unknown>) {
	return new Request('http://localhost/api/settings/email-footer-messages', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('email footer message settings routes', () => {
	beforeEach(() => {
		mockedQuery.mockReset();
	});

	it('rejects non-admin access', async () => {
		const response = await GET({ locals: clientLocals } as any);

		expect(response.status).toBe(403);
		expect(mockedQuery).not.toHaveBeenCalled();
	});

	it('lists messages for administrators', async () => {
		mockedQuery.mockResolvedValueOnce([
			{
				id: '1',
				message: 'Mailfot',
				active: true,
				created_at: '2026-08-24T10:00:00.000Z',
				updated_at: '2026-08-24T10:00:00.000Z'
			}
		]);

		const response = await GET({ locals: adminLocals } as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toEqual([
			{
				id: 1,
				message: 'Mailfot',
				active: true,
				createdAt: '2026-08-24T10:00:00.000Z',
				updatedAt: '2026-08-24T10:00:00.000Z'
			}
		]);
	});

	it('creates trimmed active messages', async () => {
		mockedQuery.mockResolvedValueOnce([
			{
				id: '2',
				message: 'Ny mailfot',
				active: true,
				created_at: null,
				updated_at: null
			}
		]);

		const response = await POST({
			locals: adminLocals,
			request: jsonRequest({ message: ' Ny mailfot ', active: true })
		} as any);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), ['Ny mailfot', true]);
		expect(body.data.message).toBe('Ny mailfot');
	});

	it('returns 404 when updating a missing message', async () => {
		mockedQuery.mockResolvedValueOnce([]);

		const response = await PATCH({
			locals: adminLocals,
			params: { id: '99' },
			request: jsonRequest({ message: 'Saknas', active: true })
		} as any);

		expect(response.status).toBe(404);
	});

	it('deletes existing messages', async () => {
		mockedQuery.mockResolvedValueOnce([{ id: '3' }]);

		const response = await DELETE({
			locals: adminLocals,
			params: { id: '3' }
		} as any);

		expect(response.status).toBe(204);
		expect(mockedQuery).toHaveBeenCalledWith(
			'DELETE FROM email_footer_messages WHERE id = $1 RETURNING id',
			[3]
		);
	});
});
