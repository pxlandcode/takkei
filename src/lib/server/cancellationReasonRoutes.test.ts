import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db', () => ({
	query: vi.fn()
}));

import { query } from '$lib/db';
import { GET as GET_PUBLIC } from '../../routes/api/get-cancellation-reasons/+server';
import { GET, POST } from '../../routes/api/settings/cancellation-reasons/+server';
import { DELETE, PATCH } from '../../routes/api/settings/cancellation-reasons/[id]/+server';

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
	return new Request('http://localhost/api/settings/cancellation-reasons', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('cancellation reason routes', () => {
	beforeEach(() => {
		mockedQuery.mockReset();
	});

	it('returns active public cancellation reasons', async () => {
		mockedQuery.mockResolvedValueOnce([{ value: 'Family', label: 'Familj' }]);

		const response = await GET_PUBLIC();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockedQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE active = TRUE'));
		expect(body).toEqual([{ value: 'Family', label: 'Familj' }]);
	});

	it('falls back to hardcoded public reasons when the table is missing', async () => {
		mockedQuery.mockRejectedValueOnce(new Error('relation does not exist'));

		const response = await GET_PUBLIC();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body[0]).toEqual({ value: 'Rebook', label: 'Flyttat träningen' });
	});

	it('can include inactive public labels for historical display', async () => {
		mockedQuery.mockResolvedValueOnce([{ value: 'Family', label: 'Familjeskäl' }]);

		const response = await GET_PUBLIC({
			url: new URL('http://localhost/api/get-cancellation-reasons?includeInactive=true')
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockedQuery).toHaveBeenCalledWith(expect.not.stringContaining('WHERE active = TRUE'));
		expect(body).toEqual([{ value: 'Family', label: 'Familjeskäl' }]);
	});

	it('rejects non-admin settings access', async () => {
		const response = await GET({ locals: clientLocals } as any);

		expect(response.status).toBe(403);
		expect(mockedQuery).not.toHaveBeenCalled();
	});

	it('lists cancellation reasons for administrators', async () => {
		mockedQuery.mockResolvedValueOnce([
			{
				id: '2',
				value: 'Travel',
				label: 'Resa',
				active: false,
				bookings_count: '4',
				created_at: null,
				updated_at: null
			}
		]);

		const response = await GET({ locals: adminLocals } as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toEqual([
			{
				id: 2,
				value: 'Travel',
				label: 'Resa',
				active: false,
				bookingsCount: 4,
				createdAt: null,
				updatedAt: null
			}
		]);
	});

	it('creates trimmed cancellation reasons with a generated stable value', async () => {
		mockedQuery.mockResolvedValueOnce([]);
		mockedQuery.mockResolvedValueOnce([]);
		mockedQuery.mockResolvedValueOnce([
			{
				id: '3',
				value: 'Vard_av_barn',
				label: 'Vård av barn',
				active: true,
				bookings_count: 0,
				created_at: null,
				updated_at: null
			}
		]);

		const response = await POST({
			locals: adminLocals,
			request: jsonRequest({ label: ' Vård av barn ', active: true })
		} as any);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(mockedQuery).toHaveBeenLastCalledWith(expect.any(String), [
			'Vard_av_barn',
			'Vård av barn',
			true
		]);
		expect(body.data.label).toBe('Vård av barn');
	});

	it('rejects duplicate cancellation reason labels', async () => {
		mockedQuery.mockResolvedValueOnce([{ id: 1 }]);

		const response = await POST({
			locals: adminLocals,
			request: jsonRequest({ label: 'Familj', active: true })
		} as any);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.errors.label).toBe('Avbokningsorsaken finns redan');
	});

	it('updates cancellation reasons for administrators', async () => {
		mockedQuery.mockResolvedValueOnce([]);
		mockedQuery.mockResolvedValueOnce([
			{
				id: '4',
				value: 'Family',
				label: 'Familjeskäl',
				active: false,
				created_at: null,
				updated_at: null
			}
		]);
		mockedQuery.mockResolvedValueOnce([
			{
				id: '4',
				value: 'Family',
				label: 'Familjeskäl',
				active: false,
				bookings_count: '3',
				created_at: null,
				updated_at: null
			}
		]);

		const response = await PATCH({
			locals: adminLocals,
			params: { id: '4' },
			request: jsonRequest({ label: ' Familjeskäl ', active: false })
		} as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toEqual({
			id: 4,
			value: 'Family',
			label: 'Familjeskäl',
			active: false,
			bookingsCount: 3,
			createdAt: null,
			updatedAt: null
		});
	});

	it('hard-deletes unused cancellation reasons', async () => {
		mockedQuery.mockResolvedValueOnce([
			{
				id: '5',
				value: 'Unused',
				label: 'Unused',
				active: true,
				bookings_count: 0,
				created_at: null,
				updated_at: null
			}
		]);
		mockedQuery.mockResolvedValueOnce([]);

		const response = await DELETE({
			locals: adminLocals,
			params: { id: '5' }
		} as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.deleted).toBe(true);
		expect(mockedQuery).toHaveBeenLastCalledWith('DELETE FROM cancellation_reasons WHERE id = $1', [
			5
		]);
	});

	it('deactivates used cancellation reasons instead of deleting them', async () => {
		mockedQuery.mockResolvedValueOnce([
			{
				id: '6',
				value: 'Family',
				label: 'Familj',
				active: true,
				bookings_count: 2,
				created_at: null,
				updated_at: null
			}
		]);
		mockedQuery.mockResolvedValueOnce([
			{
				id: '6',
				value: 'Family',
				label: 'Familj',
				active: false,
				created_at: null,
				updated_at: null
			}
		]);

		const response = await DELETE({
			locals: adminLocals,
			params: { id: '6' }
		} as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.deactivated).toBe(true);
		expect(body.data.active).toBe(false);
		expect(body.data.bookingsCount).toBe(2);
	});
});
