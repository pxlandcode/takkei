import { writable } from 'svelte/store';

export const bookingContents = writable<{ id: number; kind: string }[]>([]);

export async function fetchBookingContents() {
	try {
		const response = await fetch('/api/get-booking-contents');
		if (!response.ok) throw new Error('Failed to fetch booking contents');
		const data = await response.json();
		bookingContents.set(data);
	} catch (error) {
		console.error('Error fetching booking contents:', error);
	}
}
