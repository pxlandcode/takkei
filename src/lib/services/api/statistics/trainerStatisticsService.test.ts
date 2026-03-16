import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery } = vi.hoisted(() => ({
	mockQuery: vi.fn()
}));

vi.mock('$lib/db', () => ({
	query: mockQuery
}));

import { getTrainerStatisticsService } from './trainerStatisticsService';

describe('getTrainerStatisticsService', () => {
	beforeEach(() => {
		mockQuery.mockReset();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2025-03-12T12:00:00.000Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('excludes practice hours from billable statistics while keeping the practice row in details', async () => {
		mockQuery.mockResolvedValueOnce([]);
		mockQuery.mockResolvedValueOnce([]);
		mockQuery.mockResolvedValueOnce([
			{
				id: 1,
				start_time: '2025-03-10T09:00:00.000Z',
				end_time: '2025-03-10T10:00:00.000Z',
				status: 'Completed',
				try_out: false,
				internal: false,
				education: false,
				internal_education: false,
				booking_content_kind: null
			},
			{
				id: 2,
				start_time: '2025-03-11T09:00:00.000Z',
				end_time: '2025-03-11T10:00:00.000Z',
				status: 'Completed',
				try_out: false,
				internal: false,
				education: false,
				internal_education: true,
				booking_content_kind: null
			}
		]);
		mockQuery.mockResolvedValueOnce([]);

		const statistics = await getTrainerStatisticsService({ trainerId: 42 });
		const practiceRow = statistics.table.rows.find((row) => row.type === 'Praktiktimmar');

		expect(statistics.debiterbaraBokningar.currentWeek.totalBookings).toBe(1);
		expect(statistics.debiterbaraTimmar.weekHours).toBe(1);
		expect(statistics.debiteradePass.periods.week.hours).toBe(1);
		expect(practiceRow).toMatchObject({ hours: 1 });
		expect(statistics.table.total).toEqual({
			type: 'Debiterbart totalt',
			hours: 1,
			lateCancellations: 0,
			obTotal: 0
		});
	});
});
