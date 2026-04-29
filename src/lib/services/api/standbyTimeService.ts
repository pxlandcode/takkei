import type {
	StandbyMutationPayload,
	StandbyMutationResponse,
	StandbyTimeRecord
} from '$lib/types/standbyTypes';

type ErrorPayload = {
	error?: string;
	errors?: Record<string, string>;
};

export class StandbyApiError extends Error {
	status: number;
	errors: Record<string, string>;

	constructor(message: string, status: number, errors: Record<string, string> = {}) {
		super(message);
		this.name = 'StandbyApiError';
		this.status = status;
		this.errors = errors;
	}
}

async function parseErrorPayload(response: Response): Promise<ErrorPayload> {
	try {
		return (await response.json()) as ErrorPayload;
	} catch {
		return {};
	}
}

async function handleJsonResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const payload = await parseErrorPayload(response);
		throw new StandbyApiError(
			payload.error || 'Request failed',
			response.status,
			payload.errors ?? {}
		);
	}
	return (await response.json()) as T;
}

export async function fetchStandbyTimes(showAll = false) {
	const suffix = showAll ? '?showAll=true' : '';
	const response = await fetch(`/api/standby-times${suffix}`);
	return handleJsonResponse<StandbyTimeRecord[]>(response);
}

export async function fetchStandbyTime(id: number) {
	const response = await fetch(`/api/standby-times/${id}`);
	return handleJsonResponse<StandbyTimeRecord>(response);
}

export async function createStandbyTime(payload: StandbyMutationPayload) {
	const response = await fetch('/api/standby-times', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	return handleJsonResponse<StandbyMutationResponse>(response);
}

export async function updateStandbyTime(id: number, payload: StandbyMutationPayload) {
	const response = await fetch(`/api/standby-times/${id}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	return handleJsonResponse<StandbyMutationResponse>(response);
}

export async function deleteStandbyTime(id: number) {
	const response = await fetch(`/api/standby-times/${id}`, {
		method: 'DELETE'
	});
	return handleJsonResponse<{ success: true }>(response);
}

export async function fetchBookingStandbyTimes(bookingId: number) {
	const response = await fetch(`/api/bookings/${bookingId}/standby-times`);
	return handleJsonResponse<StandbyTimeRecord[]>(response);
}
