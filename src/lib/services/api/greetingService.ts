import type { Greeting, GreetingPayload } from '$lib/types/greeting';

type FetchLike = typeof fetch;

function resolveFetch(fetchFn?: FetchLike): FetchLike {
	return fetchFn ?? fetch;
}

function buildError(message: string, status: number, body?: any) {
	const error = new Error(message) as Error & { status?: number; errors?: Record<string, string> };
	error.status = status;
	if (body && typeof body === 'object' && body.errors) {
		error.errors = body.errors as Record<string, string>;
	}
	return error;
}

function parseList(body: any): Greeting[] {
	if (Array.isArray(body?.data)) return body.data as Greeting[];
	if (Array.isArray(body)) return body as Greeting[];
	return [];
}

export async function fetchActiveGreetings(fetchFn?: FetchLike): Promise<Greeting[]> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher('/api/greetings');
	if (!res.ok) {
		throw new Error('Kunde inte hämta hälsningar.');
	}
	const body = await res.json();
	return parseList(body);
}

export async function fetchAdminGreetings(fetchFn?: FetchLike): Promise<Greeting[]> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher('/api/settings/greetings');
	if (!res.ok) {
		throw new Error('Kunde inte hämta hälsningar.');
	}
	const body = await res.json();
	return parseList(body);
}

export async function createGreeting(payload: GreetingPayload, fetchFn?: FetchLike): Promise<Greeting> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher('/api/settings/greetings', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (res.status === 400) {
		const body = await res.json();
		throw buildError('Ogiltiga fält för hälsning.', res.status, body);
	}

	if (!res.ok) {
		throw new Error('Kunde inte skapa hälsning.');
	}

	const body = await res.json();
	return (body?.data as Greeting) ?? (body as Greeting);
}

export async function updateGreeting(
	id: number,
	payload: GreetingPayload,
	fetchFn?: FetchLike
): Promise<Greeting> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(`/api/settings/greetings/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (res.status === 400) {
		const body = await res.json();
		throw buildError('Ogiltiga fält för hälsning.', res.status, body);
	}

	if (!res.ok) {
		throw new Error('Kunde inte uppdatera hälsning.');
	}

	const body = await res.json();
	return (body?.data as Greeting) ?? (body as Greeting);
}

export async function deleteGreeting(id: number, fetchFn?: FetchLike): Promise<void> {
	const fetcher = resolveFetch(fetchFn);
	const res = await fetcher(`/api/settings/greetings/${id}`, {
		method: 'DELETE'
	});

	if (!res.ok && res.status !== 204) {
		const body = res.status === 400 ? await res.json().catch(() => null) : null;
		throw buildError('Kunde inte ta bort hälsning.', res.status, body ?? undefined);
	}
}
