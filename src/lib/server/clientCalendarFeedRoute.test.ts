import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/clientCalendarSubscriptions', () => ({
	getActiveClientCalendarSubscriptionFromToken: vi.fn(),
	getClientCalendarFeedEvents: vi.fn(),
	markClientCalendarSubscriptionAccessed: vi.fn()
}));

import {
	getActiveClientCalendarSubscriptionFromToken,
	getClientCalendarFeedEvents,
	markClientCalendarSubscriptionAccessed
} from '$lib/server/clientCalendarSubscriptions';
import { GET } from '../../routes/calendar/client/[token].ics/+server';

const mockedGetSubscription = vi.mocked(getActiveClientCalendarSubscriptionFromToken);
const mockedGetEvents = vi.mocked(getClientCalendarFeedEvents);
const mockedMarkAccessed = vi.mocked(markClientCalendarSubscriptionAccessed);

function requestEvent(token: string, headers: HeadersInit = {}): any {
	return {
		params: { token },
		request: new Request(`http://localhost/calendar/client/${token}.ics`, { headers })
	};
}

describe('client calendar feed route', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 404 for invalid tokens', async () => {
		mockedGetSubscription.mockResolvedValueOnce(null);

		const response = await GET(requestEvent('bad-token'));

		expect(response.status).toBe(404);
		expect(mockedGetEvents).not.toHaveBeenCalled();
	});

	it('serves a valid ICS feed without authentication', async () => {
		mockedGetSubscription.mockResolvedValueOnce({
			id: 9,
			clientId: 44,
			nonce: 'nonce',
			createdAt: '2026-08-18T10:00:00.000Z'
		});
		mockedGetEvents.mockResolvedValueOnce([
			{
				id: 12,
				status: 'New',
				startTime: '2026-09-01T09:00:00.000Z',
				endTime: '2026-09-01T10:00:00.000Z',
				updatedAt: '2026-08-18T11:00:00.000Z',
				locationName: 'Studio',
				trainerFirstname: 'Anna'
			}
		]);

		const response = await GET(requestEvent('valid-token'));
		const text = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
		expect(response.headers.get('etag')).toMatch(/^".+"$/);
		expect(text).toContain('BEGIN:VCALENDAR');
		expect(text).toContain('UID:takkei-client-booking-12@takkei.se');
		expect(mockedGetEvents).toHaveBeenCalledWith(44);
		expect(mockedMarkAccessed).toHaveBeenCalledWith(9);
	});

	it('returns 304 when the ETag matches', async () => {
		const subscription = {
			id: 9,
			clientId: 44,
			nonce: 'nonce',
			createdAt: '2026-08-18T10:00:00.000Z'
		};
		const events = [
			{
				id: 12,
				status: 'New',
				startTime: '2026-09-01T09:00:00.000Z',
				endTime: '2026-09-01T10:00:00.000Z',
				updatedAt: '2026-08-18T11:00:00.000Z'
			}
		];

		mockedGetSubscription.mockResolvedValue(subscription);
		mockedGetEvents.mockResolvedValue(events);

		const first = await GET(requestEvent('valid-token'));
		const etag = first.headers.get('etag');
		const second = await GET(requestEvent('valid-token', { 'if-none-match': etag ?? '' }));

		expect(second.status).toBe(304);
		expect(await second.text()).toBe('');
	});
});
