import { query } from '$lib/db';
import { extractStockholmMinutes, extractStockholmTimeParts } from '$lib/server/stockholm-time';
import { CANCELLED_STATUSES, minutesToHours } from '$lib/services/api/reports/salaryReport';

import type { TrainerStatisticsResponse } from '$lib/api/statistics';

type TrainerStatisticsParams = {
        trainerId: number;
        from?: string;
        to?: string;
};

type BookingRow = {
        id: number;
        start_time: string;
        end_time: string | null;
        status: string | null;
        try_out: boolean | null;
        internal: boolean | null;
        education: boolean | null;
        internal_education: boolean | null;
        booking_content_kind: string | null;
};

type ObWindowRow = {
        id: number;
        name: string;
        start_minutes: number;
        end_minutes: number;
        weekday_mask: number;
        include_holidays: boolean;
};

type HolidayRow = {
        date: string;
};

type RangeDescriptor = {
        label: string;
        start: string;
        endExclusive: string;
};

type ProcessedBooking = {
        id: number;
        startIso: string;
        stockholmStart: string;
        category: TableCategory;
        durationMinutes: number;
        obMinutes: number;
        isLateCancellation: boolean;
        status: string | null;
        isTryOut: boolean;
};

type TableCategory =
        | 'weekday'
        | 'weekendHoliday'
        | 'demo'
        | 'flight'
        | 'education'
        | 'practice';
type DeltaContext = 'prevWeek' | 'prevMonth' | 'currentWeek';

const STOCKHOLM_DAY_LABELS = {
        previousWeek: 'Föregående vecka',
        currentWeek: 'Denna vecka',
        nextWeek: 'Kommande vecka',
        previousMonth: 'Föregående månad',
        currentMonth: 'Denna månad'
} as const;

const TABLE_CATEGORY_LABELS: Record<TableCategory, string> = {
        weekday: 'Vardagar',
        weekendHoliday: 'Helger och helgdagar',
        demo: 'Demoträningar',
        flight: 'Flygtimmar',
        education: 'Utbildningstimmar',
        practice: 'Praktiktimmar'
};

const OB_ROW = { type: 'OB-tillägg' } as const;

export type TrainerStatisticsServiceParams = TrainerStatisticsParams;

export async function getTrainerStatisticsService(
        params: TrainerStatisticsParams
): Promise<TrainerStatisticsResponse> {
        const trainerId = Number(params.trainerId);
        if (!Number.isFinite(trainerId) || trainerId <= 0) {
                throw new Error('Invalid trainerId');
        }

        const stockholmtParts = extractStockholmTimeParts(new Date());
        if (!stockholmtParts) {
                throw new Error('Unable to determine Stockholm time');
        }

        const ranges = buildDefaultRanges(stockholmtParts);
        const customRange = buildCustomRange(params.from, params.to, ranges.currentMonth);

        const allRanges = [
                ranges.previousWeek,
                ranges.currentWeek,
                ranges.nextWeek,
                ranges.previousMonth,
                ranges.currentMonth,
                customRange
        ];
        const earliestStart = allRanges.reduce((min, range) =>
                !min || range.start < min ? range.start : min,
                ''
        );
        const latestEnd = allRanges.reduce((max, range) =>
                !max || range.endExclusive > max ? range.endExclusive : max,
                ''
        );

        const [obWindows, holidays, activeBookings, cancelledBookings] = await Promise.all([
                loadObWindows(),
                loadHolidays(earliestStart.slice(0, 10), subtractOneDay(latestEnd).slice(0, 10)),
                loadTrainerBookings(trainerId, earliestStart, latestEnd, false),
                loadTrainerBookings(trainerId, earliestStart, latestEnd, true)
        ]);

        const holidaySet = new Set(holidays.map((holiday) => holiday.date));

        const processedActive = processBookings(activeBookings, obWindows, holidaySet);
        const processedCancelled = processBookings(cancelledBookings, obWindows, holidaySet);

        const previousWeekSummary = summarizeBookings(processedActive, ranges.previousWeek);
        const currentWeekSummary = summarizeBookings(processedActive, ranges.currentWeek);
        const nextWeekSummary = summarizeBookings(processedActive, ranges.nextWeek);
        const currentMonthSummary = summarizeBookings(processedActive, ranges.currentMonth);
        const previousMonthSummary = summarizeBookings(processedActive, ranges.previousMonth);

        const debiterbaraBokningar: TrainerStatisticsResponse['debiterbaraBokningar'] = {
                currentWeek: {
                        ...currentWeekSummary,
                        deltaLabel: formatDeltaLabel(
                                currentWeekSummary.totalBookings - previousWeekSummary.totalBookings,
                                'prevWeek'
                        )
                },
                nextWeek: {
                        ...nextWeekSummary,
                        deltaLabel: formatDeltaLabel(
                                nextWeekSummary.totalBookings - currentWeekSummary.totalBookings,
                                'currentWeek'
                        )
                },
                currentMonth: {
                        ...currentMonthSummary,
                        deltaLabel: formatDeltaLabel(
                                currentMonthSummary.totalBookings - previousMonthSummary.totalBookings,
                                'prevMonth'
                        )
                }
        };

        const weekMinutes = sumMinutes(processedActive, ranges.currentWeek);
        const monthMinutes = sumMinutes(processedActive, ranges.currentMonth);
        const previousWeekMinutes = sumMinutes(processedActive, ranges.previousWeek);
        const previousMonthMinutes = sumMinutes(processedActive, ranges.previousMonth);
        const weekHours = minutesToHours(weekMinutes);
        const monthHours = minutesToHours(monthMinutes);
        const previousWeekHours = minutesToHours(previousWeekMinutes);
        const previousMonthHours = minutesToHours(previousMonthMinutes);

        const debiteradePass: TrainerStatisticsResponse['debiteradePass'] = {
                monthHours,
                deltaLabel: formatDeltaLabel(monthHours - previousMonthHours, 'prevMonth', 'h'),
                periods: {
                        week: {
                                label: STOCKHOLM_DAY_LABELS.currentWeek,
                                hours: weekHours,
                                deltaLabel: formatDeltaLabel(
                                        weekHours - previousWeekHours,
                                        'prevWeek',
                                        'h'
                                )
                        },
                        month: {
                                label: STOCKHOLM_DAY_LABELS.currentMonth,
                                hours: monthHours,
                                deltaLabel: formatDeltaLabel(
                                        monthHours - previousMonthHours,
                                        'prevMonth',
                                        'h'
                                )
                        }
                }
        };

        const monthTryOutCount = countTryOut(processedActive, ranges.currentMonth);
        const previousMonthTryOutCount = countTryOut(processedActive, ranges.previousMonth);

        const weekCancellations = summarizeCancellations(processedCancelled, ranges.currentWeek);
        const previousWeekCancellations = summarizeCancellations(
                processedCancelled,
                ranges.previousWeek
        );
        const monthCancellations = summarizeCancellations(processedCancelled, ranges.currentMonth);
        const previousMonthCancellations = summarizeCancellations(
                processedCancelled,
                ranges.previousMonth
        );

        const avbokningar: TrainerStatisticsResponse['avbokningar'] = {
                week: {
                        ...weekCancellations,
                        deltaLabel: formatDeltaLabel(
                                weekCancellations.total - previousWeekCancellations.total,
                                'prevWeek'
                        )
                },
                month: {
                        ...monthCancellations,
                        deltaLabel: formatDeltaLabel(
                                monthCancellations.total - previousMonthCancellations.total,
                                'prevMonth'
                        )
                }
        };

        const table = buildTable(processedActive, processedCancelled, customRange);

        return {
                debiterbaraBokningar,
                debiteradePass,
                demotraningar: {
                        monthCount: monthTryOutCount,
                        deltaLabel: formatDeltaLabel(
                                monthTryOutCount - previousMonthTryOutCount,
                                'prevMonth'
                        )
                },
                debiterbaraTimmar: {
                        weekHours,
                        monthHours,
                        deltaLabel: formatDeltaLabel(monthHours - previousMonthHours, 'prevMonth', 'h')
                },
                avbokningar,
                table
        };
}

function buildDefaultRanges(parts: ReturnType<typeof extractStockholmTimeParts>) {
        const todayWeekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
        const diffToMonday = (todayWeekday + 6) % 7;

        const currentMonday = shiftDays(parts, -diffToMonday);
        const nextMonday = shiftDays(currentMonday, 7);
        const followingMonday = shiftDays(currentMonday, 14);
        const previousMonday = shiftDays(currentMonday, -7);

        const monthStart = { year: parts.year, month: parts.month, day: 1 };
        const nextMonthStart = shiftMonths(monthStart, 1);
        const previousMonthStart = shiftMonths(monthStart, -1);

        return {
                previousWeek: makeRange(STOCKHOLM_DAY_LABELS.previousWeek, previousMonday, currentMonday),
                currentWeek: makeRange(STOCKHOLM_DAY_LABELS.currentWeek, currentMonday, nextMonday),
                nextWeek: makeRange(STOCKHOLM_DAY_LABELS.nextWeek, nextMonday, followingMonday),
                previousMonth: makeRange(STOCKHOLM_DAY_LABELS.previousMonth, previousMonthStart, monthStart),
                currentMonth: makeRange(STOCKHOLM_DAY_LABELS.currentMonth, monthStart, nextMonthStart)
        } satisfies Record<
                'previousWeek' | 'currentWeek' | 'nextWeek' | 'previousMonth' | 'currentMonth',
                RangeDescriptor
        >;
}

function buildCustomRange(
        from: string | undefined,
        to: string | undefined,
        fallback: RangeDescriptor
): RangeDescriptor {
        const normalizedFrom = normalizeDateInput(from);
        const normalizedTo = normalizeDateInput(to);

        if (!normalizedFrom && !normalizedTo) {
                return fallback;
        }

        const startParts = normalizedFrom ?? normalizedTo;
        const endParts = normalizedTo ?? normalizedFrom;

        if (!startParts || !endParts) {
                return fallback;
        }

        const startDate = startParts;
        const endDate = endParts;

        if (!isDateOrderValid(startDate, endDate)) {
                return fallback;
        }

        const endExclusiveParts = shiftDays(endDate, 1);
        return makeRange('Vald period', startDate, endExclusiveParts);
}

function isDateOrderValid(start: DateParts, end: DateParts) {
        const startValue = Date.UTC(start.year, start.month - 1, start.day);
        const endValue = Date.UTC(end.year, end.month - 1, end.day);
        return startValue <= endValue;
}

type DateParts = { year: number; month: number; day: number };

function normalizeDateInput(value: string | undefined): DateParts | null {
        if (!value) return null;
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        if (month < 1 || month > 12) return null;
        if (day < 1 || day > 31) return null;
        return { year, month, day };
}

function shiftDays(parts: DateParts, delta: number): DateParts {
        const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + delta));
        return {
                year: date.getUTCFullYear(),
                month: date.getUTCMonth() + 1,
                day: date.getUTCDate()
        };
}

function shiftMonths(parts: DateParts, delta: number): DateParts {
        const date = new Date(Date.UTC(parts.year, parts.month - 1 + delta, 1));
        return {
                year: date.getUTCFullYear(),
                month: date.getUTCMonth() + 1,
                day: 1
        };
}

function makeRange(label: string, start: DateParts, endExclusive: DateParts): RangeDescriptor {
        const startDate = formatDate(start);
        const endDate = formatDate(endExclusive);
        return {
                label,
                start: `${startDate} 00:00:00`,
                endExclusive: `${endDate} 00:00:00`
        };
}

function formatDate(parts: DateParts) {
        const pad = (value: number) => value.toString().padStart(2, '0');
        return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

let trainerBookingsSupportsEndTime: boolean | null = null;

async function loadTrainerBookings(
        trainerId: number,
        start: string,
        endExclusive: string,
        includeCancelled: boolean
) {
        const statusPredicate = includeCancelled
                ? 'b.status = ANY($4::text[])'
                : 'b.status <> ALL($4::text[])';

        const params = [trainerId, start, endExclusive, CANCELLED_STATUSES] as const;

        if (trainerBookingsSupportsEndTime === false) {
                return query<BookingRow>(buildTrainerBookingsQuery(false, statusPredicate), params);
        }

        try {
                const rows = await query<BookingRow>(
                        buildTrainerBookingsQuery(true, statusPredicate),
                        params
                );
                trainerBookingsSupportsEndTime = true;
                return rows;
        } catch (error) {
                if (isMissingColumnError(error)) {
                        trainerBookingsSupportsEndTime = false;
                        return query<BookingRow>(
                                buildTrainerBookingsQuery(false, statusPredicate),
                                params
                        );
                }
                throw error;
        }
}

function buildTrainerBookingsQuery(includeEndTime: boolean, statusPredicate: string) {
        const endTimeColumn = includeEndTime ? 'b.end_time,' : '';
        return `SELECT b.id,
                        b.start_time,
                        ${endTimeColumn}
                        b.status,
                        b.try_out,
                        b.internal,
                        b.education,
                        b.internal_education,
                        bc.kind AS booking_content_kind
                 FROM bookings b
                 LEFT JOIN booking_contents bc ON bc.id = b.booking_content_id
                 WHERE b.trainer_id = $1
                   AND b.start_time >= $2::timestamp
                   AND b.start_time < $3::timestamp
                   AND ${statusPredicate}
                 ORDER BY b.start_time ASC`;
}

function isMissingColumnError(error: unknown) {
        if (!error || typeof error !== 'object') return false;
        return (error as { code?: string }).code === '42703';
}

async function loadObWindows() {
        return query<ObWindowRow>(
                `SELECT id, name, start_minutes, end_minutes, weekday_mask, include_holidays
                 FROM ob_time_windows
                 WHERE active = true
                 ORDER BY start_minutes ASC`
        );
}

async function loadHolidays(startDate: string, endDate: string) {
        if (!startDate || !endDate || startDate > endDate) return [] as HolidayRow[];
        return query<HolidayRow>(
                `SELECT date::date AS date
                 FROM holidays
                 WHERE date::date BETWEEN $1::date AND $2::date`,
                [startDate, endDate]
        );
}

function processBookings(
        rows: BookingRow[],
        obWindows: ObWindowRow[],
        holidaySet: Set<string>
): ProcessedBooking[] {
        const results: ProcessedBooking[] = [];

        for (const row of rows) {
                        const processed = processBookingRow(row, obWindows, holidaySet);
                        if (processed) {
                                results.push(processed);
                        }
        }

        return results;
}

function processBookingRow(
        row: BookingRow,
        obWindows: ObWindowRow[],
        holidaySet: Set<string>
): ProcessedBooking | null {
        if (!row.start_time) return null;
        const startTime = new Date(row.start_time);
        if (Number.isNaN(startTime.getTime())) return null;

        const stockholmParts = extractStockholmTimeParts(row.start_time);
        if (!stockholmParts) return null;

        const stockholmStart = `${formatDate(stockholmParts)} ${formatTime(stockholmParts)}`;
        const dateKey = formatDate(stockholmParts);

        const weekdayUtc = new Date(
                Date.UTC(stockholmParts.year, stockholmParts.month - 1, stockholmParts.day)
        ).getUTCDay();
        const isWeekend = weekdayUtc === 0 || weekdayUtc === 6;
        const isHoliday = holidaySet.has(dateKey);

        const { endTime, durationMinutes } = resolveBookingTiming(startTime, row.end_time);
        if (!endTime || durationMinutes <= 0) return null;

        const category = determineCategory(row, { isWeekend, isHoliday });

        const startMinutes = extractStockholmMinutes(row.start_time);
        const endMinutes = extractStockholmMinutes(endTime);
        const weekdayMaskIndex = weekdayIndexFromUtcDay(weekdayUtc);

        let obMinutes = 0;
        if (category === 'weekday' && startMinutes !== null && endMinutes !== null) {
                        for (const window of obWindows) {
                                const maskMatch = (window.weekday_mask & (1 << weekdayMaskIndex)) !== 0;
                                if (!maskMatch) continue;
                                if (isHoliday && !window.include_holidays) continue;

                                const overlap = computeOverlapMinutes(
                                        startMinutes,
                                        endMinutes,
                                        window.start_minutes,
                                        window.end_minutes
                                );
                                if (overlap > 0) {
                                        obMinutes += overlap;
                                }
                        }
        }

        return {
                id: row.id,
                startIso: startTime.toISOString(),
                stockholmStart,
                category,
                durationMinutes,
                obMinutes,
                isLateCancellation: row.status === 'Late_cancelled',
                status: row.status,
                isTryOut: row.try_out === true
        };
}

function determineCategory(
        row: BookingRow,
        context: { isWeekend: boolean; isHoliday: boolean }
): TableCategory {
        if (row.internal) return 'flight'; // flygtimme stored as internal
        if (row.internal_education) return 'practice';
        if (row.education) return 'education';
        if (row.booking_content_kind === 'flight') return 'flight';
        if (row.try_out) return 'demo';
        if (context.isWeekend || context.isHoliday) return 'weekendHoliday';
        return 'weekday';
}

function summarizeBookings(bookings: ProcessedBooking[], range: RangeDescriptor) {
        const inRange = bookings.filter((booking) => isWithinRange(booking.stockholmStart, range));
        const totalBookings = inRange.length;
        const obBookings = inRange.filter((booking) => booking.obMinutes > 0).length;
        return {
                label: range.label,
                totalBookings,
                obBookings
        };
}

function sumMinutes(bookings: ProcessedBooking[], range: RangeDescriptor) {
        return bookings
                .filter((booking) => isWithinRange(booking.stockholmStart, range))
                .reduce((sum, booking) => sum + booking.durationMinutes, 0);
}

function countTryOut(bookings: ProcessedBooking[], range: RangeDescriptor) {
        return bookings.filter(
                (booking) => booking.isTryOut && isWithinRange(booking.stockholmStart, range)
        ).length;
}

function summarizeCancellations(bookings: ProcessedBooking[], range: RangeDescriptor) {
        const inRange = bookings.filter((booking) => isWithinRange(booking.stockholmStart, range));
        const total = inRange.length;
        const late = inRange.filter((booking) => booking.isLateCancellation).length;
        return {
                label: range.label,
                total,
                late
        };
}

function formatDeltaLabel(value: number, context: DeltaContext, unit?: string) {
        if (!Number.isFinite(value)) return undefined;
        const roundedAbs = Math.round(Math.abs(value) * 10) / 10;
        const formattedValue = Number.isInteger(roundedAbs) ? roundedAbs.toString() : roundedAbs.toFixed(1);
        const sign = value > 0 ? '+' : value < 0 ? '-' : '+';
        const unitSuffix = unit ? ` ${unit}` : '';
        return `${sign}${formattedValue}${unitSuffix} jämfört med ${describeDeltaContext(context)}`;
}

function describeDeltaContext(context: DeltaContext) {
        if (context === 'prevWeek') return 'förra veckan';
        if (context === 'prevMonth') return 'förra månaden';
        return 'denna vecka';
}

function buildTable(
        activeBookings: ProcessedBooking[],
        cancelledBookings: ProcessedBooking[],
        range: RangeDescriptor
) {
        const activeInRange = activeBookings.filter((booking) =>
                isWithinRange(booking.stockholmStart, range)
        );
        const cancelledInRange = cancelledBookings.filter((booking) =>
                isWithinRange(booking.stockholmStart, range)
        );

        const rows = Object.entries(TABLE_CATEGORY_LABELS).map(([category, label]) => {
                const categoryKey = category as TableCategory;
                const categoryBookings = activeInRange.filter((booking) => booking.category === categoryKey);
                const categoryCancelled = cancelledInRange.filter(
                        (booking) => booking.category === categoryKey && booking.isLateCancellation
                );

                const hours = minutesToHours(
                        categoryBookings.reduce((sum, booking) => sum + booking.durationMinutes, 0)
                );
                const lateCancellations = categoryCancelled.length;
                const obTotal = minutesToHours(
                        categoryBookings.reduce((sum, booking) => sum + booking.obMinutes, 0)
                );

                return {
                        type: label,
                        hours,
                        lateCancellations,
                        obTotal
                };
        });

        const totalObMinutes = activeInRange.reduce((sum, booking) => sum + booking.obMinutes, 0);
        rows.splice(2, 0, {
                type: OB_ROW.type,
                hours: 0,
                lateCancellations: 0,
                obTotal: minutesToHours(totalObMinutes)
        });

        const totals = rows.reduce(
                (acc, row) => {
                        acc.hours += row.hours;
                        acc.lateCancellations += row.lateCancellations;
                        acc.obTotal += row.obTotal;
                        return acc;
                },
                { type: 'Totalt', hours: 0, lateCancellations: 0, obTotal: 0 }
        );

        return {
                rows,
                total: totals
        };
}

function isWithinRange(value: string, range: RangeDescriptor) {
        return value >= range.start && value < range.endExclusive;
}

function subtractOneDay(rangeEndExclusive: string) {
        const [date] = rangeEndExclusive.split(' ');
        if (!date) return rangeEndExclusive;
        const parts = normalizeDateInput(date);
        if (!parts) return rangeEndExclusive;
        const previous = shiftDays(parts, -1);
        return `${formatDate(previous)} 00:00:00`;
}

function formatTime(parts: ReturnType<typeof extractStockholmTimeParts>) {
        const pad = (value: number) => value.toString().padStart(2, '0');
        return `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second ?? 0)}`;
}

function resolveBookingTiming(startTime: Date, rawEndTime?: string | null) {
        let resolvedEnd: Date | null = null;

        if (rawEndTime) {
                const parsed = new Date(rawEndTime);
                if (!Number.isNaN(parsed.getTime()) && parsed > startTime) {
                        resolvedEnd = parsed;
                }
        }

        if (!resolvedEnd) {
                const fallbackEnd = new Date(startTime.getTime() + 60 * 60000);
                return { endTime: fallbackEnd, durationMinutes: 60 };
        }

        const durationMinutes = Math.round((resolvedEnd.getTime() - startTime.getTime()) / 60000);
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
                const fallbackEnd = new Date(startTime.getTime() + 60 * 60000);
                return { endTime: fallbackEnd, durationMinutes: 60 };
        }

        return { endTime: resolvedEnd, durationMinutes };
}

function weekdayIndexFromUtcDay(utcDay: number) {
        return ((utcDay + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

function computeOverlapMinutes(start: number, end: number, windowStart: number, windowEnd: number) {
        const overlapStart = Math.max(start, windowStart);
        const overlapEnd = Math.min(end, windowEnd);
        return overlapEnd > overlapStart ? overlapEnd - overlapStart : 0;
}
