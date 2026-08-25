import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db', () => ({
	query: vi.fn()
}));

import { query } from '$lib/db';
import { GET } from './+server';

const mockedQuery = vi.mocked(query);

function getRequest(url: string) {
	const request = new Request(url);
	return {
		url: new URL(url),
		request
	};
}

describe('/api/bookings', () => {
	beforeEach(() => {
		mockedQuery.mockReset();
	});

	it('filters by all clientId query params', async () => {
		mockedQuery.mockResolvedValueOnce([]);

		const response = await GET(
			getRequest('http://localhost/api/bookings?from=2026-01-01&clientId=12&clientId=34') as any
		);

		expect(response.status).toBe(200);
		expect(mockedQuery).toHaveBeenCalledTimes(1);
		expect(mockedQuery.mock.calls[0][0]).toContain('bookings.client_id = ANY($2::int[])');
		expect(mockedQuery.mock.calls[0][1]).toEqual(['2026-01-01', [12, 34]]);
	});
});
