import { describe, expect, it, vi } from 'vitest';
import {
	formatDateInputValue,
	getPresetRange,
	getTrainerStatistics,
	type TrainerStatisticsResponse
} from './statistics';

const sampleResponse: TrainerStatisticsResponse = {
	debiterbaraBokningar: {
		currentWeek: { label: 'Denna vecka', totalBookings: 0, obBookings: 0 },
		nextWeek: { label: 'Kommande vecka', totalBookings: 0, obBookings: 0 },
		currentMonth: { label: 'Denna månad', totalBookings: 0, obBookings: 0 }
	},
	debiteradePass: {
		monthHours: 0,
		periods: {
			week: { label: 'Denna vecka', hours: 0 },
			month: { label: 'Denna månad', hours: 0 }
		}
	},
	demotraningar: { monthCount: 0 },
	debiterbaraTimmar: { weekHours: 0, monthHours: 0 },
	avbokningar: {
		week: { label: 'Denna vecka', total: 0, late: 0 },
		month: { label: 'Denna månad', total: 0, late: 0 }
	},
	table: {
		rows: [],
		total: { type: 'Totalt', hours: 0, lateCancellations: 0, obTotal: 0 }
	}
};

describe('statistics helpers', () => {
	it('calls the statistics endpoint with the provided range', async () => {
		const jsonMock = vi.fn().mockResolvedValue(sampleResponse);
		const fetchMock = vi
			.fn()
			.mockResolvedValue({ ok: true, json: jsonMock } as unknown as Response);

		const result = await getTrainerStatistics(
			42,
			{ from: '2024-05-01', to: '2024-05-31' },
			fetchMock
		);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			'/api/statistics?trainerId=42&from=2024-05-01&to=2024-05-31'
		);
		expect(result).toEqual(sampleResponse);
	});

	it('throws an error when the response is not ok', async () => {
		const jsonMock = vi.fn().mockResolvedValue({ error: 'boom' });
		const fetchMock = vi
			.fn()
			.mockResolvedValue({ ok: false, status: 500, json: jsonMock } as unknown as Response);

		await expect(getTrainerStatistics(5, { from: '2024-01-01' }, fetchMock)).rejects.toThrowError(
			/boom/
		);
	});

        it('provides preset ranges with ordered dates', () => {
                const { start, end } = getPresetRange('currentMonth', new Date('2025-12-28'));
                expect(start.getTime()).toBeLessThan(end.getTime());

                // Start should be the first of the month (local time), regardless of timezone offset
                expect(start.getFullYear()).toBe(2025);
                expect(start.getMonth()).toBe(11); // December (0-based)
                expect(start.getDate()).toBe(1);
                expect(start.getHours()).toBe(0);
                expect(start.getMinutes()).toBe(0);

                // End should be the last day of the same month
                const lastDayOfMonth = new Date(2026, 0, 0).getDate(); // 31 for Dec 2025
                expect(end.getFullYear()).toBe(2025);
                expect(end.getMonth()).toBe(11);
                expect(end.getDate()).toBe(lastDayOfMonth);
                expect(end.getTime()).toBeGreaterThan(start.getTime());
        });
});
