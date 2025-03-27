import { writable } from 'svelte/store';

export type Location = {
	id: number;
	name: string;
};

export const locations = writable<Location[]>([]);

export async function fetchLocations() {
	try {
		const response = await fetch('/api/locations');
		if (!response.ok) throw new Error('Failed to fetch locations');
		const data: Location[] = await response.json();
		locations.set(data);
	} catch (error) {
		console.error('Error fetching locations:', error);
	}
}
