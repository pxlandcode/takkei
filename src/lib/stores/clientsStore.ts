import { writable } from 'svelte/store';

export type Client = {
	id: number;
	firstname: string;
	lastname: string;
	email: string;
};

export const clients = writable<Client[]>([]);

export async function fetchClients() {
	try {
		const response = await fetch('/api/clients');
		if (!response.ok) throw new Error('Failed to fetch clients');
		const data: Client[] = await response.json();
		clients.set(data);
	} catch (error) {
		console.error('Error fetching clients:', error);
	}
}
