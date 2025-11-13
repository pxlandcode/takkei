export type BookingTimeframeKey = 'currentWeek' | 'nextWeek' | 'currentMonth';

export interface BookingCount {
        label: string;
        totalBookings: number;
        obBookings: number;
        deltaLabel?: string;
}

export type PeriodKey = 'week' | 'month';

export interface DebiteradePassPeriodStats {
        label: string;
        hours: number;
        deltaLabel?: string;
}

export interface DebiteradePass {
        monthHours: number;
        deltaLabel?: string;
        periods: Record<PeriodKey, DebiteradePassPeriodStats>;
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

export type CancellationPeriodKey = PeriodKey;

export interface CancellationPeriodStats {
        label: string;
        total: number;
        late: number;
        deltaLabel?: string;
}

export type AvbokningarStats = Record<CancellationPeriodKey, CancellationPeriodStats>;

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
        avbokningar: AvbokningarStats;
        table: StatisticsTable;
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit | undefined) => Promise<Response>;

export async function getTrainerStatistics(
        trainerId: number,
        range?: { from?: string; to?: string },
        fetchFn: FetchLike = fetch
): Promise<TrainerStatisticsResponse> {
        if (!Number.isFinite(trainerId) || trainerId <= 0) {
                throw new Error('trainerId is required');
        }

        const params = new URLSearchParams({ trainerId: String(trainerId) });
        if (range?.from) params.set('from', range.from);
        if (range?.to) params.set('to', range.to);

        const response = await fetchFn(`/api/statistics?${params.toString()}`);
        if (!response.ok) {
                let message = `Failed to fetch trainer statistics (${response.status})`;
                try {
                        const data = await response.json();
                        if (data && typeof data === 'object' && 'error' in data && data.error) {
                                message = String(data.error);
                        }
                } catch (error) {
                        // Swallow JSON parsing errors to preserve the original message
                        console.error('Failed to parse statistics error response', error);
                }
                throw new Error(message);
        }

        return (await response.json()) as TrainerStatisticsResponse;
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
