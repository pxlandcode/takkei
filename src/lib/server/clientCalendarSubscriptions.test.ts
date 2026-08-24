import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db', () => ({
	query: vi.fn()
}));

import { query } from '$lib/db';
import {
	getActiveClientCalendarSubscriptionFromToken,
	getClientCalendarFeedEvents,
	parseSignedClientCalendarToken,
	resolveClientCalendarPublicOrigin,
	signClientCalendarToken
} from './clientCalendarSubscriptions';

const SECRET = 'calendar-feed-secret-for-tests-1234567890';
const mockedQuery = vi.mocked(query);
const ORIGINAL_PUBLIC_APP_ORIGIN = process.env.PUBLIC_APP_ORIGIN;

describe('client calendar subscription tokens', () => {
	beforeEach(() => {
		process.env.CALENDAR_FEED_SECRET = SECRET;
		if (ORIGINAL_PUBLIC_APP_ORIGIN === undefined) {
			delete process.env.PUBLIC_APP_ORIGIN;
		} else {
			process.env.PUBLIC_APP_ORIGIN = ORIGINAL_PUBLIC_APP_ORIGIN;
		}
		mockedQuery.mockReset();
	});

	afterAll(() => {
		if (ORIGINAL_PUBLIC_APP_ORIGIN === undefined) {
			delete process.env.PUBLIC_APP_ORIGIN;
		} else {
			process.env.PUBLIC_APP_ORIGIN = ORIGINAL_PUBLIC_APP_ORIGIN;
		}
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

	it('uses configured public origin for generated client calendar links', () => {
		process.env.PUBLIC_APP_ORIGIN = 'https://superadmin.takkei.se/admin';

		expect(resolveClientCalendarPublicOrigin('http://localhost:5173')).toBe(
			'https://superadmin.takkei.se'
		);
	});

	it('ignores local configured origins for generated client calendar links', () => {
		process.env.PUBLIC_APP_ORIGIN = 'http://localhost:5173';

		expect(resolveClientCalendarPublicOrigin('http://localhost:5173')).toBe(
			'https://superadmin.takkei.se'
		);
	});

	it('falls back to the Takkei public origin for local request origins', () => {
		expect(resolveClientCalendarPublicOrigin('http://localhost:5173')).toBe(
			'https://superadmin.takkei.se'
		);
		expect(resolveClientCalendarPublicOrigin('http://[::1]:5173')).toBe(
			'https://superadmin.takkei.se'
		);
	});

	it('keeps non-local request origins when no public origin is configured', () => {
		expect(resolveClientCalendarPublicOrigin('https://staging.takkei.se')).toBe(
			'https://staging.takkei.se'
		);
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
