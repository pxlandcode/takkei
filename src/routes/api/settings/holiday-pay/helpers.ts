import type { HolidayPay } from '$lib/types/holidayPay';

export type HolidayPayRow = {
	user_id: number;
	firstname: string;
	lastname: string;
	amount: number | string | null;
	created_at: string | null;
	updated_at: string | null;
};

export function parseTimestamp(value: any): number | undefined {
	if (!value) return undefined;
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
	if (typeof value === 'string') {
		const normalized = value.replace(' ', 'T');
		const withZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
		const ms = Date.parse(withZone);
		if (!Number.isNaN(ms)) return ms;
	}
	const ms = Date.parse(String(value));
	return Number.isNaN(ms) ? undefined : ms;
}

function toIsoTimestamp(value: string | Date | null | undefined): string | null {
	if (!value) return null;
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

export function normalizeAmount(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const normalized = value.replace(',', '.').trim();
		if (normalized === '') return null;
		const parsed = Number.parseFloat(normalized);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

export function mapHolidayPayRow(row: HolidayPayRow): HolidayPay {
	const amount =
		typeof row.amount === 'string'
			? Number.parseFloat(row.amount)
			: Number.isFinite(row.amount)
			? Number(row.amount)
			: 0;

	return {
		userId: Number(row.user_id),
		firstname: String(row.firstname ?? ''),
		lastname: String(row.lastname ?? ''),
		amount: Number.isFinite(amount) ? amount : 0,
		createdAt: toIsoTimestamp(row.created_at),
		updatedAt: toIsoTimestamp(row.updated_at)
	};
}
