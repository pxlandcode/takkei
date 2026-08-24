import type { BookingContent, BookingContentPayload } from '$lib/types/bookingContent';
import { invalidateByPrefix, wrapFetch } from '$lib/services/api/apiCache';

type FetchLike = typeof fetch;

const baseUrl = '/api/settings/booking-contents';
const publicBookingContentsUrl = '/api/get-booking-contents';

export type DeleteBookingContentResult = {
	deleted: boolean;
	deactivated: boolean;
	data?: BookingContent | { id: number };
};

function resolveFetch(fetchFn?: FetchLike): FetchLike {
	return wrapFetch(fetchFn ?? fetch);
}

function buildError(message: string, status: number, body?: any) {
	const error = new Error(message) as Error & { status?: number; errors?: Record<string, string> };
	error.status = status;
	if (body && typeof body === 'object' && body.errors) {
		error.errors = body.errors as Record<string, string>;
	}
	return error;
}

function parseList(body: any): BookingContent[] {
	if (Array.isArray(body?.data)) return body.data as BookingContent[];
	if (Array.isArray(body)) return body as BookingContent[];
	return [];
}

function parseItem(body: any): BookingContent {
	return (body?.data as BookingContent) ?? (body as BookingContent);
}

function invalidateBookingContentCaches() {
	invalidateByPrefix(baseUrl);
	invalidateByPrefix(publicBookingContentsUrl);
}

export async function fetchAdminBookingContents(fetchFn?: FetchLike): Promise<BookingContent[]> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(baseUrl);
	if (!res.ok) {
		throw new Error('Kunde inte hämta passtyper.');
	}

	return parseList(await res.json());
}

export async function createBookingContent(
	payload: BookingContentPayload,
	fetchFn?: FetchLike
): Promise<BookingContent> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(baseUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (res.status === 400) {
		const body = await res.json();
		throw buildError('Ogiltiga fält för passtyp.', res.status, body);
	}

	if (!res.ok) {
		throw new Error('Kunde inte skapa passtyp.');
	}

	const body = await res.json();
	invalidateBookingContentCaches();
	return parseItem(body);
}

export async function updateBookingContent(
	id: number,
	payload: BookingContentPayload,
	fetchFn?: FetchLike
): Promise<BookingContent> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(`${baseUrl}/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (res.status === 400) {
		const body = await res.json();
		throw buildError('Ogiltiga fält för passtyp.', res.status, body);
	}

	if (!res.ok) {
		throw new Error('Kunde inte uppdatera passtyp.');
	}

	const body = await res.json();
	invalidateBookingContentCaches();
	return parseItem(body);
}

export async function deleteBookingContent(
	id: number,
	fetchFn?: FetchLike
): Promise<DeleteBookingContentResult> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(`${baseUrl}/${id}`, {
		method: 'DELETE'
	});

	if (!res.ok) {
		const body = res.status === 400 ? await res.json().catch(() => null) : null;
		throw buildError('Kunde inte ta bort passtyp.', res.status, body ?? undefined);
	}

	const body = await res.json();
	invalidateBookingContentCaches();
	return {
		deleted: Boolean(body?.deleted),
		deactivated: Boolean(body?.deactivated),
		data: body?.data
	};
}
