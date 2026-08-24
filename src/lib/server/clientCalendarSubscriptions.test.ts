import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db', () => ({
	query: vi.fn()
}));

import { query } from '$lib/db';
import {
	getActiveClientCalendarSubscriptionFromToken,
	getClientCalendarFeedEvents,
	parseSignedClientCalendarToken,
	signClientCalendarToken
} from './clientCalendarSubscriptions';

const SECRET = 'calendar-feed-secret-for-tests-1234567890';
const mockedQuery = vi.mocked(query);

describe('client calendar subscription tokens', () => {
	beforeEach(() => {
		process.env.CALENDAR_FEED_SECRET = SECRET;
		mockedQuery.mockReset();
	});

	it('signs and validates a feed token', () => {
		const token = signClientCalendarToken(42, 'nonce_123', SECRET);

		expect(parseSignedClientCalendarToken(token, SECRET)).toEqual({
			subscriptionId: 42,
			nonce: 'nonce_123'
		});
	});

	it('rejects malformed and tampered tokens', () => {
		const token = signClientCalendarToken(42, 'nonce_123', SECRET);
		const tampered = token.replace('nonce_123', 'nonce_456');

		expect(parseSignedClientCalendarToken('not-a-token', SECRET)).toBeNull();
		expect(parseSignedClientCalendarToken(tampered, SECRET)).toBeNull();
	});

	it('rejects revoked or unknown subscriptions', async () => {
		const token = signClientCalendarToken(7, 'active_nonce', SECRET);
		mockedQuery.mockResolvedValueOnce([]);

		await expect(getActiveClientCalendarSubscriptionFromToken(token)).resolves.toBeNull();
		expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [7, 'active_nonce']);
	});

	it('returns an active subscription from a valid token', async () => {
		const token = signClientCalendarToken(7, 'active_nonce', SECRET);
		mockedQuery.mockResolvedValueOnce([
			{
				id: '7',
				client_id: '19',
				nonce: 'active_nonce',
				created_at: '2026-08-18T10:00:00.000Z'
			}
		]);

		await expect(getActiveClientCalendarSubscriptionFromToken(token)).resolves.toEqual({
			id: 7,
			clientId: 19,
			nonce: 'active_nonce',
			createdAt: '2026-08-18T10:00:00.000Z'
		});
	});

	it('loads feed events without selecting a non-existent booking end_time column', async () => {
		mockedQuery.mockResolvedValueOnce([
			{
				id: '31',
				status: 'New',
				start_time: '2026-09-01T09:00:00.000Z',
				created_at: '2026-08-18T10:00:00.000Z',
				updated_at: '2026-08-18T11:00:00.000Z',
				location_name: 'Studio',
				booking_content_id: '4',
				booking_content_kind: 'Träning'
			}
		]);

		await expect(getClientCalendarFeedEvents(19)).resolves.toEqual([
			{
				id: 31,
				status: 'New',
				startTime: '2026-09-01T09:00:00.000Z',
				endTime: null,
				createdAt: '2026-08-18T10:00:00.000Z',
				updatedAt: '2026-08-18T11:00:00.000Z',
				locationName: 'Studio',
				bookingContentId: 4,
				bookingContentKind: 'Träning'
			}
		]);

		const sql = String(mockedQuery.mock.calls[0][0]);
		expect(sql).not.toContain('bookings.end_time');
	});
});
