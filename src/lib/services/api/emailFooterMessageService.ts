import type { EmailFooterMessage, EmailFooterMessagePayload } from '$lib/types/emailFooterMessage';
import { invalidateByPrefix, wrapFetch } from '$lib/services/api/apiCache';

type FetchLike = typeof fetch;

const baseUrl = '/api/settings/email-footer-messages';

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

function parseList(body: any): EmailFooterMessage[] {
	if (Array.isArray(body?.data)) return body.data as EmailFooterMessage[];
	if (Array.isArray(body)) return body as EmailFooterMessage[];
	return [];
}

export async function fetchAdminEmailFooterMessages(
	fetchFn?: FetchLike
): Promise<EmailFooterMessage[]> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(baseUrl);
	if (!res.ok) {
		throw new Error('Kunde inte hämta mailfoten.');
	}

	return parseList(await res.json());
}

export async function createEmailFooterMessage(
	payload: EmailFooterMessagePayload,
	fetchFn?: FetchLike
): Promise<EmailFooterMessage> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(baseUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (res.status === 400) {
		const body = await res.json();
		throw buildError('Ogiltiga fält för mailfot.', res.status, body);
	}

	if (!res.ok) {
		throw new Error('Kunde inte skapa mailfot.');
	}

	const body = await res.json();
	invalidateByPrefix(baseUrl);
	return (body?.data as EmailFooterMessage) ?? (body as EmailFooterMessage);
}

export async function updateEmailFooterMessage(
	id: number,
	payload: EmailFooterMessagePayload,
	fetchFn?: FetchLike
): Promise<EmailFooterMessage> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(`${baseUrl}/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (res.status === 400) {
		const body = await res.json();
		throw buildError('Ogiltiga fält för mailfot.', res.status, body);
	}

	if (!res.ok) {
		throw new Error('Kunde inte uppdatera mailfot.');
	}

	const body = await res.json();
	invalidateByPrefix(baseUrl);
	return (body?.data as EmailFooterMessage) ?? (body as EmailFooterMessage);
}

export async function deleteEmailFooterMessage(id: number, fetchFn?: FetchLike): Promise<void> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(`${baseUrl}/${id}`, {
		method: 'DELETE'
	});

	if (!res.ok && res.status !== 204) {
		const body = res.status === 400 ? await res.json().catch(() => null) : null;
		throw buildError('Kunde inte ta bort mailfot.', res.status, body ?? undefined);
	}

	invalidateByPrefix(baseUrl);
}
