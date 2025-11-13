import type { Holiday, HolidayPayload, HolidayRange } from '$lib/types/holiday';

type FetchLike = typeof fetch;

type HolidayServiceError = Error & {
        status?: number;
        errors?: Record<string, string>;
};

function resolveFetch(fetchFn?: FetchLike): FetchLike {
        return fetchFn ?? fetch;
}

function buildError(message: string, status: number, body?: any): HolidayServiceError {
        const error = new Error(message) as HolidayServiceError;
        error.status = status;
        if (body && typeof body === 'object' && body.errors) {
                error.errors = body.errors as Record<string, string>;
        }
        return error;
}

function toUrl(base: string, params: Record<string, string | undefined>) {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
                if (value) {
                        search.set(key, value);
                }
        }
        const qs = search.toString();
        return qs ? `${base}?${qs}` : base;
}

export async function fetchHolidays(
        range?: Partial<HolidayRange>,
        fetchFn?: FetchLike
): Promise<Holiday[]> {
        const fetcher = resolveFetch(fetchFn);
        const url = toUrl('/api/holidays', {
                from: range?.from,
                to: range?.to
        });

        const res = await fetcher(url);
        if (!res.ok) {
                throw new Error('Kunde inte hämta helgdagar.');
        }

        const body = await res.json();
        return Array.isArray(body?.data) ? (body.data as Holiday[]) : [];
}

export async function fetchAdminHolidays(
        showPassed = false,
        fetchFn?: FetchLike
): Promise<Holiday[]> {
        const fetcher = resolveFetch(fetchFn);
        const url = toUrl('/api/settings/holidays', {
                showPassed: showPassed ? 'true' : undefined
        });

        const res = await fetcher(url);
        if (!res.ok) {
                throw new Error('Kunde inte hämta helgdagar.');
        }

        const body = await res.json();
        return Array.isArray(body?.data) ? (body.data as Holiday[]) : [];
}

export async function createHoliday(
        payload: HolidayPayload,
        fetchFn?: FetchLike
): Promise<Holiday> {
        const fetcher = resolveFetch(fetchFn);
        const res = await fetcher('/api/settings/holidays', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
        });

        if (res.status === 400) {
            const body = await res.json();
            throw buildError('Ogiltiga fält för helgdag.', res.status, body);
        }

        if (!res.ok) {
                throw new Error('Kunde inte skapa helgdag.');
        }

        const body = await res.json();
        return body?.data as Holiday;
}

export async function updateHoliday(
        id: number,
        payload: HolidayPayload,
        fetchFn?: FetchLike
): Promise<Holiday> {
        const fetcher = resolveFetch(fetchFn);
        const res = await fetcher(`/api/settings/holidays/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
        });

        if (res.status === 400) {
                const body = await res.json();
                throw buildError('Ogiltiga fält för helgdag.', res.status, body);
        }

        if (!res.ok) {
                throw new Error('Kunde inte uppdatera helgdag.');
        }

        const body = await res.json();
        return body?.data as Holiday;
}

export async function deleteHoliday(id: number, fetchFn?: FetchLike): Promise<void> {
        const fetcher = resolveFetch(fetchFn);
        const res = await fetcher(`/api/settings/holidays/${id}`, {
                method: 'DELETE'
        });

        if (!res.ok && res.status !== 204) {
                const body = res.status === 400 ? await res.json().catch(() => null) : null;
                throw buildError('Kunde inte ta bort helgdag.', res.status, body ?? undefined);
        }
}

export type { HolidayServiceError };
