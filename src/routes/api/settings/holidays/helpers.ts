import type { Holiday } from '$lib/types/holiday';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type NormalizedPayload = {
        name: string;
        date: string;
        description: string | null;
};

export type NormalizedHolidayPayload = NormalizedPayload;

export type HolidayValidationResult = {
        errors: Record<string, string>;
        values: NormalizedPayload;
};

function toDateOnlyString(value: string | Date | null | undefined): string {
        if (!value) return '';
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
                const year = value.getFullYear();
                const month = String(value.getMonth() + 1).padStart(2, '0');
                const day = String(value.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
        }

        const asString = String(value).trim();
        if (ISO_DATE_RE.test(asString)) {
                const [year, month, day] = asString.split('-').map(Number);
                const parsed = new Date(asString);
                if (
                        !Number.isNaN(parsed.getTime()) &&
                        parsed.getUTCFullYear() === year &&
                        parsed.getUTCMonth() + 1 === month &&
                        parsed.getUTCDate() === day
                ) {
                        return asString;
                }
                return '';
        }

        const parsed = new Date(asString);
        if (!Number.isNaN(parsed.getTime())) {
                const year = parsed.getUTCFullYear();
                const month = parsed.getUTCMonth() + 1;
                const day = parsed.getUTCDate();
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }

        return '';
}

function toIsoTimestamp(value: string | Date | null | undefined): string {
        if (!value) return '';
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
                return value.toISOString();
        }
        const normalized = String(value).trim();
        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.getTime())) {
                return parsed.toISOString();
        }
        return normalized;
}

export function validateHolidayPayload(payload: Record<string, unknown>): HolidayValidationResult {
        const errors: Record<string, string> = {};

        const name = typeof payload.name === 'string' ? payload.name.trim() : '';
        if (!name) {
                errors.name = 'Namn krävs';
        }

        let rawDate: string | Date | null = null;
        if (payload.date instanceof Date) {
                rawDate = payload.date;
        } else if (typeof payload.date === 'string') {
                rawDate = payload.date.trim();
        }

        const normalizedDate = toDateOnlyString(rawDate);
        if (!rawDate || (typeof rawDate === 'string' && rawDate.trim() === '')) {
                errors.date = 'Datum krävs';
        } else if (!normalizedDate) {
                errors.date = 'Ogiltigt datum';
        }

        const description =
                typeof payload.description === 'string' ? payload.description.trim() : null;

        return {
                errors,
                values: {
                        name,
                        date: normalizedDate,
                        description: description ? description : null
                }
        };
}

export type HolidayRow = {
        id: number;
        name: string;
        date: string;
        description: string | null;
        created_at: string | null;
        updated_at: string | null;
};

export function mapHolidayRow(row: HolidayRow): Holiday {
        return {
                id: Number(row.id),
                name: String(row.name ?? ''),
                date: toDateOnlyString(row.date) || toDateOnlyString(row.date?.toString?.()),
                description: row.description != null && row.description !== '' ? String(row.description) : null,
                createdAt: toIsoTimestamp(row.created_at),
                updatedAt: toIsoTimestamp(row.updated_at)
        };
}

export function parseShowPassedParam(value: string | null | undefined): boolean {
        if (typeof value !== 'string') return false;
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'ja', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'nej', 'off'].includes(normalized)) return false;
        return false;
}

export function resolveRange(params: URLSearchParams, defaults: { from: string; to: string }) {
        const fromParam = params.get('from');
        const toParam = params.get('to');

        const from = toDateOnlyString(fromParam ?? defaults.from) || defaults.from;
        const to = toDateOnlyString(toParam ?? defaults.to) || defaults.to;

        if (from > to) {
                return { from: to, to: from };
        }

        return { from, to };
}

export function formatDateOnly(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
}
