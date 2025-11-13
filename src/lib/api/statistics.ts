export type BookingTimeframeKey = 'currentWeek' | 'nextWeek' | 'currentMonth';

export interface BookingCount {
        label: string;
        totalBookings: number;
        obBookings: number;
        deltaLabel?: string;
}

export interface DebiteradePass {
        monthHours: number;
        deltaLabel?: string;
}

export interface DemoTrainingCount {
        monthCount: number;
        deltaLabel?: string;
}

export interface DebiterbaraTimmar {
        weekHours: number;
        monthHours: number;
        deltaLabel?: string;
}

export interface StatisticsTableRow {
        type: string;
        hours: number;
        lateCancellations: number;
        obTotal: number;
}

export interface StatisticsTable {
        rows: StatisticsTableRow[];
        total: StatisticsTableRow;
}

export interface TrainerStatisticsResponse {
        debiterbaraBokningar: Record<BookingTimeframeKey, BookingCount>;
        debiteradePass: DebiteradePass;
        demotraningar: DemoTrainingCount;
        debiterbaraTimmar: DebiterbaraTimmar;
        table: StatisticsTable;
}

const mockResponse: TrainerStatisticsResponse = {
        debiterbaraBokningar: {
                currentWeek: {
                        label: 'Denna vecka',
                        totalBookings: 12,
                        obBookings: 3,
                        deltaLabel: '+2 vs föregående vecka'
                },
                nextWeek: {
                        label: 'Kommande vecka',
                        totalBookings: 9,
                        obBookings: 1,
                        deltaLabel: '-1 vs föregående vecka'
                },
                currentMonth: {
                        label: 'Denna månad',
                        totalBookings: 38,
                        obBookings: 6,
                        deltaLabel: '+6 vs föregående månad'
                }
        },
        debiteradePass: {
                monthHours: 112,
                deltaLabel: '+8 h jämfört med förra månaden'
        },
        demotraningar: {
                monthCount: 5,
                deltaLabel: '+1 vs föregående månad'
        },
        debiterbaraTimmar: {
                weekHours: 24,
                monthHours: 118,
                deltaLabel: '+6 h vs förra månaden'
        },
        table: {
                rows: [
                        { type: 'Vardagar', hours: 82, lateCancellations: 2, obTotal: 4 },
                        { type: 'Helger och helgdagar', hours: 18, lateCancellations: 0, obTotal: 6 },
                        { type: 'OB-tillägg', hours: 0, lateCancellations: 0, obTotal: 12 },
                        { type: 'Demoträningar', hours: 6, lateCancellations: 1, obTotal: 0 },
                        { type: 'Flygtimmar', hours: 4, lateCancellations: 0, obTotal: 0 },
                        { type: 'Utbildningstimmar', hours: 12, lateCancellations: 0, obTotal: 0 },
                        { type: 'Praktiktimmar', hours: 8, lateCancellations: 0, obTotal: 0 }
                ],
                total: { type: 'Totalt', hours: 130, lateCancellations: 3, obTotal: 22 }
        }
};

/**
 * Temporary helper that mocks the statistics endpoint for "Mina sidor".
 * Swap this function out with the real API call once the backend endpoint is ready.
 */
export async function getMockTrainerStatistics(): Promise<TrainerStatisticsResponse> {
        // The timeout keeps the function async to mirror a real network call.
        await new Promise((resolve) => setTimeout(resolve, 50));
        return JSON.parse(JSON.stringify(mockResponse)) as TrainerStatisticsResponse;
}

export type StatisticsPreset = 'currentWeek' | 'currentMonth' | 'previousMonth';

export function getPresetRange(preset: StatisticsPreset, now = new Date()): { start: Date; end: Date } {
        const date = new Date(now);
        const start = new Date(now);
        const end = new Date(now);

        if (preset === 'currentWeek') {
                const day = date.getDay();
                const diffToMonday = (day + 6) % 7; // Monday as start of week
                start.setDate(date.getDate() - diffToMonday);
                start.setHours(0, 0, 0, 0);

                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
        } else if (preset === 'currentMonth') {
                start.setDate(1);
                start.setHours(0, 0, 0, 0);

                end.setMonth(date.getMonth() + 1, 0);
                end.setHours(23, 59, 59, 999);
        } else if (preset === 'previousMonth') {
                start.setMonth(date.getMonth() - 1, 1);
                start.setHours(0, 0, 0, 0);

                end.setMonth(date.getMonth(), 0);
                end.setHours(23, 59, 59, 999);
        }

        return { start, end };
}

export function formatDateInputValue(date: Date): string {
        return date.toISOString().split('T')[0];
}
