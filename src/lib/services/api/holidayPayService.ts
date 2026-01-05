import { invalidateByPrefix, wrapFetch } from '$lib/services/api/apiCache';
import type { HolidayPay, HolidayPayUpdatePayload } from '$lib/types/holidayPay';

type FetchLike = typeof fetch;

export type HolidayPayServiceError = Error & {
	status?: number;
	errors?: Record<string, string>;
};

function resolveFetch(fetchFn?: FetchLike): FetchLike {
	return wrapFetch(fetchFn ?? fetch);
}

function toNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const normalized = value.replace(',', '.').trim();
		if (!normalized) return null;
		const parsed = Number.parseFloat(normalized);
		return Number.isFinite(parsed) ? parsed : null;
	}
	if (value === null || value === undefined) return 0;
	return null;
}

function normalizeEntry(raw: any): HolidayPay | null {
	if (!raw) return null;

	const amount = toNumber(raw.amount ?? raw.total ?? 0);
	if (!Number.isFinite(amount)) return null;

	const userId = Number(raw.userId ?? raw.user_id ?? raw.id);
	if (!Number.isFinite(userId)) return null;

	return {
		userId,
		firstname: typeof raw.firstname === 'string' ? raw.firstname : undefined,
		lastname: typeof raw.lastname === 'string' ? raw.lastname : undefined,
		amount,
		createdAt: (raw.createdAt ?? raw.created_at ?? null) as string | null,
		updatedAt: (raw.updatedAt ?? raw.updated_at ?? null) as string | null
	};
}

function buildError(message: string, status: number, body?: any): HolidayPayServiceError {
	const error = new Error(message) as HolidayPayServiceError;
	error.status = status;
	if (body && typeof body === 'object' && body.errors) {
		error.errors = body.errors as Record<string, string>;
	}
	return error;
}

export async function fetchHolidayPayForUser(fetchFn?: FetchLike): Promise<HolidayPay | null> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher('/api/holiday-pay');

	if (res.status === 404) {
		return null;
	}

	if (!res.ok) {
		throw new Error('Could not fetch holiday pay.');
	}

	const body = await res.json().catch(() => null);
	return normalizeEntry(body?.data ?? body);
}

export async function fetchHolidayPayAdmin(fetchFn?: FetchLike): Promise<HolidayPay[]> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher('/api/settings/holiday-pay');

	if (!res.ok) {
		throw new Error('Could not fetch holiday pay.');
	}

	const body = await res.json().catch(() => null);
	const list = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
	return list.map((item) => normalizeEntry(item)).filter((item): item is HolidayPay => Boolean(item));
}

export async function saveHolidayPay(
	payload: HolidayPayUpdatePayload,
	fetchFn?: FetchLike
): Promise<HolidayPay> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher('/api/settings/holiday-pay', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (res.status === 400 || res.status === 404) {
		const body = await res.json().catch(() => null);
		throw buildError('Invalid fields for holiday pay.', res.status, body ?? undefined);
	}

	if (!res.ok) {
		throw new Error('Could not save holiday pay.');
	}

	const body = await res.json().catch(() => null);
	invalidateByPrefix('/api/settings/holiday-pay');
	invalidateByPrefix('/api/holiday-pay');

	const normalized = normalizeEntry(body?.data ?? body);
	if (!normalized) {
		throw new Error('Response missing valid data.');
	}
	return normalized;
}
