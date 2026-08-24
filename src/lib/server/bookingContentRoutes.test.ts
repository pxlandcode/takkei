import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db', () => ({
	query: vi.fn()
}));

import { query } from '$lib/db';
import { GET as GET_PUBLIC } from '../../routes/api/get-booking-contents/+server';
import { GET, POST } from '../../routes/api/settings/booking-contents/+server';
import { DELETE, PATCH } from '../../routes/api/settings/booking-contents/[id]/+server';

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
	return new Request('http://localhost/api/settings/booking-contents', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
}

describe('booking content routes', () => {
	beforeEach(() => {
		mockedQuery.mockReset();
	});

	it('returns active public booking contents with icons', async () => {
		mockedQuery.mockResolvedValueOnce([
			{
				id: '1',
				kind: 'Weightlifting',
				icon: 'Training',
				active: true,
				created_at: null,
				updated_at: null
			}
		]);

		const response = await GET_PUBLIC({} as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockedQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE active = TRUE'));
		expect(body).toEqual([
			{
				id: 1,
				kind: 'Weightlifting',
				icon: 'Training',
				active: true,
				createdAt: null,
				updatedAt: null
			}
		]);
	});

	it('rejects non-admin settings access', async () => {
		const response = await GET({ locals: clientLocals } as any);

		expect(response.status).toBe(403);
		expect(mockedQuery).not.toHaveBeenCalled();
	});

	it('lists pass types for administrators', async () => {
		mockedQuery.mockResolvedValueOnce([
			{
				id: '2',
				kind: 'Mobility',
				icon: 'Mobility',
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
				kind: 'Mobility',
				icon: 'Mobility',
				active: false,
				bookingsCount: 4,
				createdAt: null,
				updatedAt: null
			}
		]);
	});

	it('creates trimmed pass types', async () => {
		mockedQuery.mockResolvedValueOnce([]);
		mockedQuery.mockResolvedValueOnce([
			{
				id: '3',
				kind: 'Gymnastik',
				icon: 'Gymnastics',
				active: true,
				bookings_count: 0,
				created_at: null,
				updated_at: null
			}
		]);

		const response = await POST({
			locals: adminLocals,
			request: jsonRequest({ kind: ' Gymnastik ', icon: 'Gymnastics', active: true })
		} as any);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(mockedQuery).toHaveBeenLastCalledWith(expect.any(String), [
			'Gymnastik',
			'Gymnastics',
			true
		]);
		expect(body.data.kind).toBe('Gymnastik');
	});

	it('rejects duplicate pass type names', async () => {
		mockedQuery.mockResolvedValueOnce([{ id: 1 }]);

		const response = await POST({
			locals: adminLocals,
			request: jsonRequest({ kind: 'Mobility', icon: 'Mobility', active: true })
		} as any);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.errors.kind).toBe('Passtypen finns redan');
	});

	it('updates pass types for administrators', async () => {
		mockedQuery.mockResolvedValueOnce([]);
		mockedQuery.mockResolvedValueOnce([
			{
				id: '4',
				kind: 'Mobilitet',
				icon: 'Mobility',
				active: false,
				created_at: null,
				updated_at: null
			}
		]);
		mockedQuery.mockResolvedValueOnce([
			{
				id: '4',
				kind: 'Mobilitet',
				icon: 'Mobility',
				active: false,
				bookings_count: '3',
				created_at: null,
				updated_at: null
			}
		]);

		const response = await PATCH({
			locals: adminLocals,
			params: { id: '4' },
			request: jsonRequest({ kind: ' Mobilitet ', icon: 'Mobility', active: false })
		} as any);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data).toEqual({
			id: 4,
			kind: 'Mobilitet',
			icon: 'Mobility',
			active: false,
			bookingsCount: 3,
			createdAt: null,
			updatedAt: null
		});
	});

	it('returns 404 when updating a missing pass type', async () => {
		mockedQuery.mockResolvedValueOnce([]);
		mockedQuery.mockResolvedValueOnce([]);

		const response = await PATCH({
			locals: adminLocals,
			params: { id: '99' },
			request: jsonRequest({ kind: 'Saknas', icon: 'Training', active: true })
		} as any);

		expect(response.status).toBe(404);
	});

	it('returns 404 when deleting a missing pass type', async () => {
		mockedQuery.mockResolvedValueOnce([]);

		const response = await DELETE({
			locals: adminLocals,
			params: { id: '404' }
		} as any);

		expect(response.status).toBe(404);
	});

	it('hard-deletes unused pass types', async () => {
		mockedQuery.mockResolvedValueOnce([
			{
				id: '5',
				kind: 'Unused',
				icon: 'Training',
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
		expect(mockedQuery).toHaveBeenLastCalledWith('DELETE FROM booking_contents WHERE id = $1', [5]);
	});

	it('deactivates used pass types instead of deleting them', async () => {
		mockedQuery.mockResolvedValueOnce([
			{
				id: '6',
				kind: 'Used',
				icon: 'Training',
				active: true,
				bookings_count: 2,
				created_at: null,
				updated_at: null
			}
		]);
		mockedQuery.mockResolvedValueOnce([
			{
				id: '6',
				kind: 'Used',
				icon: 'Training',
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
