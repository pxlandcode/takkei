import { query } from '$lib/db';
import { extractStockholmMinutes, extractStockholmTimeParts } from '$lib/server/stockholm-time';

export const CANCELLED_STATUSES = ['Cancelled', 'Late_cancelled'];

const LATE_CANCELLATION_STATUS = 'late_cancelled';

const SALARY_EXCLUDED_STATUSES: string[] = CANCELLED_STATUSES.map((status) =>
	status.toLowerCase()
).filter((status) => status !== LATE_CANCELLATION_STATUS);
const FALLBACK_SESSION_MINUTES = 60; // Default duration when bookings lack explicit end_time

export type SalaryReportParams = {
        month: number;
        year: number;
};

export type SalaryReportDetail = {
        id: number;
        startTime: string;
        endTime: string | null;
        durationMinutes: number;
        obMinutes?: number;
        clientName: string | null;
        customerName: string | null;
        bookingType: string | null;
        locationName: string | null;
};

export type SalaryReportExtraDuty = {
        id: number;
        name: string;
        approved: boolean;
        note: string | null;
};

export type SalaryReportTrainer = {
        id: number;
        name: string;
        email: string | null;
        locationId: number | null;
        locationName: string | null;
        weekdayHours: number;
        obHours: number;
        weekendHours: number;
        holidayHours: number;
        educationHours: number;
        tryOutHours: number;
        internalHours: number;
        totalHours: number;
        sessionCount: number;
        approvedExtra: number;
        pendingExtra: number;
        weekday: SalaryReportDetail[];
        ob: SalaryReportDetail[];
        weekend: SalaryReportDetail[];
        holiday: SalaryReportDetail[];
        education: SalaryReportDetail[];
        tryOut: SalaryReportDetail[];
        internal: SalaryReportDetail[];
        extraDuties: SalaryReportExtraDuty[];
};

export type SalaryReportResult = {
        month: number;
        year: number;
        generatedAt: string;
        range: { start: string; end: string };
        isMonthComplete: boolean;
        trainers: SalaryReportTrainer[];
};

export function parseSalaryReportMonth(params: { month?: string | null; year?: string | null }) {
        const { month, year } = params;
        if (month && /^\d{4}-\d{2}$/.test(month)) {
                const [yearStr, monthStr] = month.split('-');
                const parsedYear = Number(yearStr);
                const parsedMonth = Number(monthStr);
                if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 9999) {
                        throw new Error('Invalid year parameter');
                }
                if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
                        throw new Error('Invalid month parameter');
                }
                return { month: parsedMonth, year: parsedYear };
        }

        const monthValue = month ? Number(month) : NaN;
        const yearValue = year ? Number(year) : NaN;

        if (!Number.isInteger(monthValue) || monthValue < 1 || monthValue > 12) {
                throw new Error('Invalid month parameter');
        }

        if (!Number.isInteger(yearValue) || yearValue < 2000 || yearValue > 9999) {
                throw new Error('Invalid year parameter');
        }

        return { month: monthValue, year: yearValue };
}

type BookingRow = {
        id: number;
        start_time: string;
        end_time?: string | null;
        trainer_id: number;
        trainer_firstname: string | null;
        trainer_lastname: string | null;
        trainer_email: string | null;
        trainer_location_id: number | null;
        trainer_location_name: string | null;
        try_out: boolean | null;
        internal: boolean | null;
        education: boolean | null;
        internal_education: boolean | null;
        booking_content_kind: string | null;
        client_firstname: string | null;
        client_lastname: string | null;
        customer_name: string | null;
        location_name: string | null;
        status: string | null;
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
        holiday_name: string | null;
        holiday_description: string | null;
};

type ExtraDutyRow = {
        id: number;
        extra_duty_id: number | null;
        approved_by_id: number | null;
        month: string | null;
        duty: string | null;
        user_id: number | null;
        note?: string | null;
};

type TrainerMetaRow = {
        id: number;
        firstname: string | null;
        lastname: string | null;
        email: string | null;
        default_location_id: number | null;
        location_name: string | null;
};

type TrainerAccumulator = {
        id: number;
        firstname: string | null;
        lastname: string | null;
        email: string | null;
        locationId: number | null;
        locationName: string | null;
        weekdayMinutes: number;
        obMinutes: number;
        weekendMinutes: number;
        holidayMinutes: number;
        educationMinutes: number;
        tryOutMinutes: number;
        internalMinutes: number;
        sessionCount: number;
        approvedExtra: number;
        pendingExtra: number;
        weekday: SalaryReportDetail[];
        ob: SalaryReportDetail[];
        weekend: SalaryReportDetail[];
        holiday: SalaryReportDetail[];
        education: SalaryReportDetail[];
        tryOut: SalaryReportDetail[];
        internal: SalaryReportDetail[];
        extraDuties: SalaryReportExtraDuty[];
};

type BookingCategory = 'weekday' | 'weekend' | 'holiday' | 'education' | 'tryOut' | 'internal';

export function minutesToHours(minutes: number) {
        if (!minutes) return 0;
        const hours = minutes / 60;
        return Math.round((hours + Number.EPSILON) * 100) / 100;
}

function createDateKey(parts: ReturnType<typeof extractStockholmTimeParts>) {
        if (!parts) return null;
        const pad = (value: number) => value.toString().padStart(2, '0');
        return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function weekdayIndexFromUtcDay(utcDay: number) {
        // Monday bit = 1 << 0 ... Sunday = 1 << 6
        return ((utcDay + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

function computeOverlapMinutes(start: number, end: number, windowStart: number, windowEnd: number) {
        const overlapStart = Math.max(start, windowStart);
        const overlapEnd = Math.min(end, windowEnd);
        return overlapEnd > overlapStart ? overlapEnd - overlapStart : 0;
}

function formatName(firstname: string | null, lastname: string | null) {
        const parts = [firstname, lastname].map((value) => value?.trim()).filter((value) => value);
        return parts.join(' ');
}

function normalizeClientName(firstname: string | null, lastname: string | null, fallback: string | null) {
        const name = formatName(firstname, lastname);
        if (name) return name;
        return fallback ?? null;
}

function ensureTrainer(map: Map<number, TrainerAccumulator>, row: BookingRow | ExtraDutyRow) {
        const trainerId = 'trainer_id' in row ? row.trainer_id : row.user_id;
        if (!trainerId || !Number.isFinite(trainerId)) return null;

        if (!map.has(trainerId)) {
                let firstname: string | null = null;
                let lastname: string | null = null;
                let email: string | null = null;
                let locationId: number | null = null;
                let locationName: string | null = null;

                if ('trainer_firstname' in row) {
                        firstname = row.trainer_firstname;
                        lastname = row.trainer_lastname;
                        email = row.trainer_email;
                        locationId = row.trainer_location_id;
                        locationName = row.trainer_location_name;
                }

                map.set(trainerId, {
                        id: trainerId,
                        firstname,
                        lastname,
                        email,
                        locationId,
                        locationName,
                        weekdayMinutes: 0,
                        obMinutes: 0,
                        weekendMinutes: 0,
                        holidayMinutes: 0,
                        educationMinutes: 0,
                        tryOutMinutes: 0,
                        internalMinutes: 0,
                        sessionCount: 0,
                        approvedExtra: 0,
                        pendingExtra: 0,
                        weekday: [],
                        ob: [],
                        weekend: [],
                        holiday: [],
                        education: [],
                        tryOut: [],
                        internal: [],
                        extraDuties: []
                });
        }

        return map.get(trainerId) ?? null;
}

function sortDetails(values: SalaryReportDetail[]) {
        values.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

function normalizeWorkbookBuffer(raw: unknown) {
        if (raw instanceof Uint8Array) return raw;
        if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
        if (ArrayBuffer.isView(raw)) {
                const view = raw as ArrayBufferView;
                return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        }
        throw new Error('Unsupported workbook buffer type');
}

async function hydrateTrainerMetadata(map: Map<number, TrainerAccumulator>, candidateIds: number[]) {
        if (!candidateIds.length) return;
        const uniqueIds = Array.from(new Set(candidateIds.filter((value) => Number.isFinite(value))));
        if (!uniqueIds.length) return;

        const rows = await query<TrainerMetaRow>(
                `SELECT u.id,
                        u.firstname,
                        u.lastname,
                        u.email,
                        u.default_location_id,
                        l.name AS location_name
                 FROM users u
                 LEFT JOIN locations l ON l.id = u.default_location_id
                 WHERE u.id = ANY($1::int[])`,
                [uniqueIds]
        );

        for (const row of rows) {
                const trainer = map.get(row.id);
                if (!trainer) continue;
                trainer.firstname = row.firstname;
                trainer.lastname = row.lastname;
                trainer.email = row.email;
                trainer.locationId = row.default_location_id;
                trainer.locationName = row.location_name;
        }
}

async function loadObWindows() {
        const rows = await query<ObWindowRow>(
                `SELECT id, name, start_minutes, end_minutes, weekday_mask, include_holidays
                 FROM ob_time_windows
                 WHERE active = true
                 ORDER BY start_minutes ASC`
        );
        return rows;
}

async function loadHolidays(startDate: string, endDate: string) {
        if (startDate > endDate) return [] as HolidayRow[];
        const rows = await query<HolidayRow>(
                `SELECT
                        date::date AS date,
                        name AS holiday_name,
                        description AS holiday_description
                 FROM holidays
                 WHERE date::date BETWEEN $1::date AND $2::date`,
                [startDate, endDate]
        );
        return rows;
}

async function loadBookings(start: string, endExclusive: string) {
	const params: [string, string, string[]] = [start, endExclusive, SALARY_EXCLUDED_STATUSES];

        if (bookingsSupportsEndTime === false) {
                return query<BookingRow>(buildBookingsQuery(false), params);
        }

        try {
                const rows = await query<BookingRow>(buildBookingsQuery(true), params);
                bookingsSupportsEndTime = true;
                return rows;
        } catch (error) {
                if (isMissingColumnError(error)) {
                        bookingsSupportsEndTime = false;
                        return query<BookingRow>(buildBookingsQuery(false), params);
                }
                throw error;
        }
}

let bookingsSupportsEndTime: boolean | null = null;

function buildBookingsQuery(includeEndTime: boolean) {
        const endTimeColumn = includeEndTime ? 'b.end_time,' : '';
	return `SELECT
			b.id,
			b.start_time,
			${endTimeColumn}
                        b.trainer_id,
                        u.firstname AS trainer_firstname,
                        u.lastname AS trainer_lastname,
                        u.email AS trainer_email,
                        u.default_location_id AS trainer_location_id,
                        tl.name AS trainer_location_name,
                        b.try_out,
                        b.internal,
                        b.education,
                        b.internal_education,
                        bc.kind AS booking_content_kind,
                        c.firstname AS client_firstname,
                        c.lastname AS client_lastname,
                        cu.name AS customer_name,
                        l.name AS location_name,
                        b.status
                 FROM bookings b
                 JOIN users u ON u.id = b.trainer_id
                 LEFT JOIN locations tl ON tl.id = u.default_location_id
                 LEFT JOIN clients c ON c.id = b.client_id
                 LEFT JOIN customers cu ON cu.id = c.customer_id
                 LEFT JOIN booking_contents bc ON bc.id = b.booking_content_id
		LEFT JOIN locations l ON l.id = b.location_id
		WHERE COALESCE(LOWER(b.status), '') <> ALL($3::text[])
		  AND b.start_time >= $1::timestamp
		  AND b.start_time < $2::timestamp
		ORDER BY b.start_time ASC`;
}

function isMissingColumnError(error: unknown) {
        if (!error || typeof error !== 'object') return false;
        return (error as { code?: string }).code === '42703';
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
                const fallbackEnd = new Date(startTime.getTime() + FALLBACK_SESSION_MINUTES * 60000);
                return { endTime: fallbackEnd, durationMinutes: FALLBACK_SESSION_MINUTES };
        }

        const durationMinutes = Math.round((resolvedEnd.getTime() - startTime.getTime()) / 60000);
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
                const fallbackEnd = new Date(startTime.getTime() + FALLBACK_SESSION_MINUTES * 60000);
                return { endTime: fallbackEnd, durationMinutes: FALLBACK_SESSION_MINUTES };
        }

        return { endTime: resolvedEnd, durationMinutes };
}

async function loadExtraDuties(rangeStart: string, nextMonthStart: string) {
        const rows = await query<ExtraDutyRow>(
                `SELECT ped.id,
                        ped.extra_duty_id,
                        ped.approved_by_id,
                        ped.month,
                        ed.duty,
                        ed.user_id
                 FROM performed_extra_duties ped
                 JOIN extra_duties ed ON ed.id = ped.extra_duty_id
                 WHERE ped.month >= $1::date
                   AND ped.month < $2::date`,
                [rangeStart, nextMonthStart]
        );
        return rows;
}

function determineRange(params: SalaryReportParams) {
        const { month, year } = params;
        const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        const startOfNextMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        const endOfMonth = new Date(startOfNextMonth.getTime() - 1);

        const now = new Date();
        const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
        const todayEndUtc = new Date(todayUtc.getTime() + 24 * 60 * 60 * 1000);

        if (start > todayUtc) {
                        throw new Error('Selected month is in the future');
        }

        const rangeEndDate = endOfMonth < todayEndUtc ? endOfMonth : new Date(todayEndUtc.getTime() - 1);
        const endExclusive = rangeEndDate < endOfMonth ? todayEndUtc : startOfNextMonth;

        const isMonthComplete = endOfMonth <= new Date(todayEndUtc.getTime() - 1);

        return {
                start,
                endExclusive,
                endInclusiveDate: new Date(rangeEndDate.getTime()),
                isMonthComplete
        };
}

function formatIsoDate(date: Date) {
        return date.toISOString();
}

function toDateOnly(date: Date) {
        const clone = new Date(date.getTime());
        clone.setUTCHours(0, 0, 0, 0);
        return clone;
}

function toIsoDateOnly(date: Date) {
        return toDateOnly(date).toISOString().slice(0, 10);
}

export async function getSalaryReport(params: SalaryReportParams): Promise<SalaryReportResult> {
        const { start, endExclusive, endInclusiveDate, isMonthComplete } = determineRange(params);
        const rangeStartIso = formatIsoDate(start);
        const rangeEndExclusiveIso = formatIsoDate(endExclusive);
        const rangeEndIso = formatIsoDate(endInclusiveDate);

        const [obWindows, holidays, bookings, extraDuties] = await Promise.all([
                loadObWindows(),
                loadHolidays(toIsoDateOnly(start), toIsoDateOnly(endInclusiveDate)),
                loadBookings(rangeStartIso, rangeEndExclusiveIso),
                loadExtraDuties(toIsoDateOnly(start), toIsoDateOnly(endExclusive))
        ]);

        const holidaySet = new Set(holidays.map((row) => row.date));
        const trainerMap = new Map<number, TrainerAccumulator>();

        for (const row of bookings) {
                if (!row.trainer_id) continue;
                const trainer = ensureTrainer(trainerMap, row);
                if (!trainer) continue;

                const startTime = new Date(row.start_time);
                if (!startTime || Number.isNaN(startTime.getTime())) continue;

                const { endTime, durationMinutes } = resolveBookingTiming(startTime, row.end_time);
                if (!endTime || durationMinutes <= 0) continue;

                const timeParts = extractStockholmTimeParts(row.start_time);
                if (!timeParts) continue;

                const dateKey = createDateKey(timeParts);
                if (!dateKey) continue;

                const weekdayUtc = new Date(Date.UTC(timeParts.year, timeParts.month - 1, timeParts.day)).getUTCDay();
                const isWeekend = weekdayUtc === 0 || weekdayUtc === 6;
                const isHoliday = holidaySet.has(dateKey);
                const isTryOut = row.try_out === true;
                const isInternal = row.internal === true;
                const isEducation = row.education === true || row.internal_education === true;

                let category: BookingCategory;
                if (isTryOut) {
                        category = 'tryOut';
                } else if (isInternal) {
                        category = 'internal';
                } else if (isEducation) {
                        category = 'education';
                } else if (isWeekend) {
                        category = 'weekend';
                } else if (isHoliday) {
                        category = 'holiday';
                } else {
                        category = 'weekday';
                }

                const startMinutes = extractStockholmMinutes(row.start_time);
                const endMinutes = extractStockholmMinutes(endTime);
                const weekdayMaskIndex = weekdayIndexFromUtcDay(weekdayUtc);

                let obMinutes = 0;
                if (startMinutes !== null && endMinutes !== null) {
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

                const detail: SalaryReportDetail = {
                        id: row.id,
                        startTime: startTime.toISOString(),
                        endTime: endTime.toISOString(),
                        durationMinutes,
                        obMinutes: obMinutes > 0 ? obMinutes : undefined,
                        clientName: normalizeClientName(row.client_firstname, row.client_lastname, row.customer_name),
                        customerName: row.customer_name,
                        bookingType: row.booking_content_kind,
                        locationName: row.location_name
                };

                trainer.sessionCount += 1;

                switch (category) {
                        case 'tryOut':
                                trainer.tryOutMinutes += durationMinutes;
                                trainer.tryOut.push(detail);
                                break;
                        case 'internal':
                                trainer.internalMinutes += durationMinutes;
                                trainer.internal.push(detail);
                                break;
                        case 'education':
                                trainer.educationMinutes += durationMinutes;
                                trainer.education.push(detail);
                                break;
                        case 'weekend':
                                trainer.weekendMinutes += durationMinutes;
                                trainer.weekend.push(detail);
                                break;
                        case 'holiday':
                                trainer.holidayMinutes += durationMinutes;
                                trainer.holiday.push(detail);
                                break;
                        default:
                                trainer.weekdayMinutes += durationMinutes;
                                trainer.weekday.push(detail);
                                break;
                }

                if (obMinutes > 0) {
                        trainer.obMinutes += obMinutes;
                        trainer.ob.push(detail);
                }
        }

        const includeApprovedEntries = isMonthComplete;

        for (const row of extraDuties) {
                const trainer = ensureTrainer(trainerMap, row);
                if (!trainer) continue;

                const approved = row.approved_by_id !== null;
                if (approved) {
                        trainer.approvedExtra += 1;
                } else {
                        trainer.pendingExtra += 1;
                }

                if (!includeApprovedEntries && approved) {
                        continue;
                }

                trainer.extraDuties.push({
                        id: row.id,
                        name: row.duty ?? 'Okänd arbetsuppgift',
                        approved,
                        note: row.note ?? null
                });
        }

        const missingMetadataIds = Array.from(trainerMap.values())
                .filter((trainer) => !trainer.firstname && !trainer.lastname)
                .map((trainer) => trainer.id);
        if (missingMetadataIds.length > 0) {
                await hydrateTrainerMetadata(trainerMap, missingMetadataIds);
        }

        const trainers: SalaryReportTrainer[] = [];
        for (const trainer of trainerMap.values()) {
                sortDetails(trainer.weekday);
                sortDetails(trainer.ob);
                sortDetails(trainer.weekend);
                sortDetails(trainer.holiday);
                sortDetails(trainer.education);
                sortDetails(trainer.tryOut);
                sortDetails(trainer.internal);

                const totalMinutes =
                        trainer.weekdayMinutes +
                        trainer.weekendMinutes +
                        trainer.holidayMinutes +
                        trainer.educationMinutes +
                        trainer.tryOutMinutes +
                        trainer.internalMinutes;

                trainers.push({
                        id: trainer.id,
                        name: formatName(trainer.firstname, trainer.lastname) || 'Okänd tränare',
                        email: trainer.email ?? null,
                        locationId: trainer.locationId,
                        locationName: trainer.locationName ?? null,
                        weekdayHours: minutesToHours(trainer.weekdayMinutes),
                        obHours: minutesToHours(trainer.obMinutes),
                        weekendHours: minutesToHours(trainer.weekendMinutes),
                        holidayHours: minutesToHours(trainer.holidayMinutes),
                        educationHours: minutesToHours(trainer.educationMinutes),
                        tryOutHours: minutesToHours(trainer.tryOutMinutes),
                        internalHours: minutesToHours(trainer.internalMinutes),
                        totalHours: minutesToHours(totalMinutes),
                        sessionCount: trainer.sessionCount,
                        approvedExtra: trainer.approvedExtra,
                        pendingExtra: trainer.pendingExtra,
                        weekday: trainer.weekday,
                        ob: trainer.ob,
                        weekend: trainer.weekend,
                        holiday: trainer.holiday,
                        education: trainer.education,
                        tryOut: trainer.tryOut,
                        internal: trainer.internal,
                        extraDuties: trainer.extraDuties
                });
        }

        trainers.sort((a, b) => a.name.localeCompare(b.name, 'sv'));

        return {
                month: params.month,
                year: params.year,
                generatedAt: new Date().toISOString(),
                range: {
                        start: formatIsoDate(start),
                        end: rangeEndIso
                },
                isMonthComplete,
                trainers
        };
}

type ExcelModule = typeof import('exceljs');

async function createWorkbook(): Promise<import('exceljs').Workbook> {
        const mod = (await import('exceljs')) as ExcelModule & { default?: ExcelModule };
        const excelNs = mod.Workbook ? mod : mod.default;
        if (!excelNs?.Workbook) {
                throw new Error('ExcelJS module does not expose a Workbook constructor.');
        }
        return new excelNs.Workbook();
}

function autoFitColumns(worksheet: import('exceljs').Worksheet) {
        worksheet.columns?.forEach((column) => {
                if (!column) return;
                let max = 12;
                column.eachCell?.({ includeEmpty: true }, (cell) => {
                        const text = cell.value?.toString?.() ?? '';
                        if (text.length + 2 > max) max = text.length + 2;
                });
                column.width = Math.min(max, 50);
        });
}

function formatHours(hours: number) {
        return Math.round((hours + Number.EPSILON) * 100) / 100;
}

function formatTotals(trainers: SalaryReportTrainer[]) {
        return trainers.reduce(
                (acc, trainer) => {
                        acc.totalHours += trainer.totalHours;
                        acc.weekdayHours += trainer.weekdayHours;
                        acc.obHours += trainer.obHours;
                        acc.weekendHours += trainer.weekendHours;
                        acc.holidayHours += trainer.holidayHours;
                        acc.educationHours += trainer.educationHours;
                        acc.tryOutHours += trainer.tryOutHours;
                        acc.internalHours += trainer.internalHours;
                        acc.sessionCount += trainer.sessionCount;
                        acc.approvedExtra += trainer.approvedExtra;
                        acc.pendingExtra += trainer.pendingExtra;
                        return acc;
                },
                {
                        totalHours: 0,
                        weekdayHours: 0,
                        obHours: 0,
                        weekendHours: 0,
                        holidayHours: 0,
                        educationHours: 0,
                        tryOutHours: 0,
                        internalHours: 0,
                        sessionCount: 0,
                        approvedExtra: 0,
                        pendingExtra: 0
                }
        );
}

function buildFilename(result: SalaryReportResult) {
        const monthStr = result.month.toString().padStart(2, '0');
        const timestamp = new Date(result.generatedAt)
                .toISOString()
                .replace(/[-:]/g, '')
                .slice(0, 13);
        return `loneunderlag_${result.year}_${monthStr}_${timestamp}.xlsx`;
}

export async function buildSalaryWorkbook(params: SalaryReportParams) {
        const report = await getSalaryReport(params);
        const workbook = await createWorkbook();
        const summarySheet = workbook.addWorksheet('Översikt');

        summarySheet.addRow([
                'Tränare',
                'Total timmar',
                'Vardagstimmar',
                'OB-timmar',
                'Helgtimmar',
                'Helgdagstimmar',
                'Utbildningstimmar',
                'Prova-på-timmar',
                'Interna timmar',
                'Antal pass',
                'Godkända extra',
                'Avvaktande extra'
        ]);
        summarySheet.getRow(1).font = { bold: true };

        for (const trainer of report.trainers) {
                summarySheet.addRow([
                        trainer.name,
                        formatHours(trainer.totalHours),
                        formatHours(trainer.weekdayHours),
                        formatHours(trainer.obHours),
                        formatHours(trainer.weekendHours),
                        formatHours(trainer.holidayHours),
                        formatHours(trainer.educationHours),
                        formatHours(trainer.tryOutHours),
                        formatHours(trainer.internalHours),
                        trainer.sessionCount,
                        trainer.approvedExtra,
                        trainer.pendingExtra
                ]);
        }

        summarySheet.getColumn(2).numFmt = '0.00';
        summarySheet.getColumn(3).numFmt = '0.00';
        summarySheet.getColumn(4).numFmt = '0.00';
        summarySheet.getColumn(5).numFmt = '0.00';
        summarySheet.getColumn(6).numFmt = '0.00';
        summarySheet.getColumn(7).numFmt = '0.00';
        summarySheet.getColumn(8).numFmt = '0.00';
        summarySheet.getColumn(9).numFmt = '0.00';

        autoFitColumns(summarySheet);
        summarySheet.views = [{ state: 'frozen', ySplit: 1 }];

        const totalsRow = summarySheet.addRow(new Array(summarySheet.columnCount).fill(''));
        totalsRow.getCell(1).value = 'Totalt';
        totalsRow.font = { bold: true };
        const totals = formatTotals(report.trainers);
        totalsRow.getCell(2).value = formatHours(totals.totalHours);
        totalsRow.getCell(3).value = formatHours(totals.weekdayHours);
        totalsRow.getCell(4).value = formatHours(totals.obHours);
        totalsRow.getCell(5).value = formatHours(totals.weekendHours);
        totalsRow.getCell(6).value = formatHours(totals.holidayHours);
        totalsRow.getCell(7).value = formatHours(totals.educationHours);
        totalsRow.getCell(8).value = formatHours(totals.tryOutHours);
        totalsRow.getCell(9).value = formatHours(totals.internalHours);
        totalsRow.getCell(10).value = totals.sessionCount;
        totalsRow.getCell(11).value = totals.approvedExtra;
        totalsRow.getCell(12).value = totals.pendingExtra;

        const obSheet = workbook.addWorksheet('OB-detaljer');
        obSheet.addRow([
                'Tränare',
                'Start',
                'Slut',
                'OB-minuter',
                'OB-timmar',
                'Total minuter',
                'Total timmar',
                'Klient',
                'Kund',
                'Typ'
        ]);
        obSheet.getRow(1).font = { bold: true };

        for (const trainer of report.trainers) {
                for (const booking of trainer.ob) {
                        const obMinutes = booking.obMinutes ?? booking.durationMinutes;
                        obSheet.addRow([
                                trainer.name,
                                booking.startTime ? new Date(booking.startTime) : null,
                                booking.endTime ? new Date(booking.endTime) : null,
                                obMinutes,
                                formatHours(obMinutes / 60),
                                booking.durationMinutes,
                                formatHours(booking.durationMinutes / 60),
                                booking.clientName ?? '',
                                booking.customerName ?? '',
                                booking.bookingType ?? ''
                        ]);
                }
        }

        obSheet.getColumn(2).numFmt = 'yyyy-mm-dd hh:mm';
        obSheet.getColumn(3).numFmt = 'yyyy-mm-dd hh:mm';
        obSheet.getColumn(4).numFmt = '0';
        obSheet.getColumn(5).numFmt = '0.00';
        obSheet.getColumn(6).numFmt = '0';
        obSheet.getColumn(7).numFmt = '0.00';
        autoFitColumns(obSheet);
        obSheet.views = [{ state: 'frozen', ySplit: 1 }];

        const rawBuffer = await workbook.xlsx.writeBuffer();
        const buffer = normalizeWorkbookBuffer(rawBuffer);
        const filename = buildFilename(report);

        return { buffer, filename };
}
