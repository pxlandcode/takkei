import type { CreateEventResponse, EventInfo } from '$lib/types/event';

export async function createEvent(eventInfo: Partial<EventInfo>): Promise<CreateEventResponse> {
	try {
		const res = await fetch('/api/create-event', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(eventInfo)
		});

		if (!res.ok) {
			const errData = await res.json();
			throw new Error(errData.error || 'Failed to create event');
		}

		const data: CreateEventResponse = await res.json();
		return data;
	} catch (error) {
		console.error('Error creating event:', error);
		throw new Error('Network error or failed request');
	}
}
