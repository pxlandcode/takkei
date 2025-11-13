import { describe, expect, it } from 'vitest';
import { formatDateInputValue, getMockTrainerStatistics, getPresetRange } from './statistics';

describe('statistics helpers', () => {
        it('returns mock statistics with coherent totals', async () => {
                const stats = await getMockTrainerStatistics();
                const hours = stats.table.rows.reduce((sum, row) => sum + row.hours, 0);
                const late = stats.table.rows.reduce((sum, row) => sum + row.lateCancellations, 0);
                const ob = stats.table.rows.reduce((sum, row) => sum + row.obTotal, 0);

                expect(stats.table.total.hours).toBe(hours);
                expect(stats.table.total.lateCancellations).toBe(late);
                expect(stats.table.total.obTotal).toBe(ob);
        });

        it('provides preset ranges with ordered dates', () => {
                const { start, end } = getPresetRange('currentMonth', new Date('2024-05-15'));
                expect(start.getTime()).toBeLessThan(end.getTime());
                expect(formatDateInputValue(start)).toBe('2024-05-01');
        });
});
