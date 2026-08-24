import type { CancellationReason, CancellationReasonPayload } from '$lib/types/cancellationReason';
import { invalidateByPrefix, wrapFetch } from '$lib/services/api/apiCache';

type FetchLike = typeof fetch;

const baseUrl = '/api/settings/cancellation-reasons';
const publicCancellationReasonsUrl = '/api/get-cancellation-reasons';

export type DeleteCancellationReasonResult = {
	deleted: boolean;
	deactivated: boolean;
	data?: CancellationReason | { id: number };
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

function parseList(body: any): CancellationReason[] {
	if (Array.isArray(body?.data)) return body.data as CancellationReason[];
	if (Array.isArray(body)) return body as CancellationReason[];
	return [];
}

function parseItem(body: any): CancellationReason {
	return (body?.data as CancellationReason) ?? (body as CancellationReason);
}

function invalidateCancellationReasonCaches() {
	invalidateByPrefix(baseUrl);
	invalidateByPrefix(publicCancellationReasonsUrl);
}

export async function fetchAdminCancellationReasons(
	fetchFn?: FetchLike
): Promise<CancellationReason[]> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(baseUrl);
	if (!res.ok) {
		throw new Error('Kunde inte hämta avbokningsorsaker.');
	}

	return parseList(await res.json());
}

export async function createCancellationReason(
	payload: CancellationReasonPayload,
	fetchFn?: FetchLike
): Promise<CancellationReason> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(baseUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (res.status === 400) {
		const body = await res.json();
		throw buildError('Ogiltiga fält för avbokningsorsak.', res.status, body);
	}

	if (!res.ok) {
		throw new Error('Kunde inte skapa avbokningsorsak.');
	}

	const body = await res.json();
	invalidateCancellationReasonCaches();
	return parseItem(body);
}

export async function updateCancellationReason(
	id: number,
	payload: CancellationReasonPayload,
	fetchFn?: FetchLike
): Promise<CancellationReason> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(`${baseUrl}/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (res.status === 400) {
		const body = await res.json();
		throw buildError('Ogiltiga fält för avbokningsorsak.', res.status, body);
	}

	if (!res.ok) {
		throw new Error('Kunde inte uppdatera avbokningsorsak.');
	}

	const body = await res.json();
	invalidateCancellationReasonCaches();
	return parseItem(body);
}

export async function deleteCancellationReason(
	id: number,
	fetchFn?: FetchLike
): Promise<DeleteCancellationReasonResult> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(`${baseUrl}/${id}`, {
		method: 'DELETE'
	});

	if (!res.ok) {
		const body = res.status === 400 ? await res.json().catch(() => null) : null;
		throw buildError('Kunde inte ta bort avbokningsorsak.', res.status, body ?? undefined);
	}

	const body = await res.json();
	invalidateCancellationReasonCaches();
	return {
		deleted: Boolean(body?.deleted),
		deactivated: Boolean(body?.deactivated),
		data: body?.data
	};
}
