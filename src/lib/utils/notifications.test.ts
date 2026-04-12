import { describe, expect, it } from 'vitest';

import { getNotificationDisplayStart, sortNotifications } from './notifications';

describe('notifications utils', () => {
	it('uses start_time before created_at for display', () => {
		expect(
			getNotificationDisplayStart({
				start_time: '2026-04-12T10:00:00.000Z',
				created_at: '2026-04-12T08:00:00.000Z'
			})
		).toBe('2026-04-12T10:00:00.000Z');

		expect(
			getNotificationDisplayStart({
				start_time: null,
				created_at: '2026-04-12T08:00:00.000Z'
			})
		).toBe('2026-04-12T08:00:00.000Z');
	});

	it('sorts alerts first and then by start_time with created_at fallback', () => {
		const sorted = sortNotifications([
			{
				id: 1,
				event_type: 'info',
				start_time: '2026-04-12T09:00:00.000Z',
				created_at: '2026-04-12T08:00:00.000Z'
			},
			{
				id: 2,
				event_type: 'alert',
				start_time: '2026-04-10T09:00:00.000Z',
				created_at: '2026-04-10T08:00:00.000Z'
			},
			{
				id: 3,
				event_type: 'info',
				start_time: null,
				created_at: '2026-04-12T10:00:00.000Z'
			},
			{
				id: 4,
				event_type: 'info',
				start_time: '2026-04-12T11:00:00.000Z',
				created_at: '2026-04-12T07:00:00.000Z'
			}
		]);

		expect(sorted.map((notification) => notification.id)).toEqual([2, 4, 3, 1]);
	});
});
