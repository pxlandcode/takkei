import type { User } from '$lib/types/userTypes';
import { writable } from 'svelte/store';
import { wrapFetch } from '$lib/services/api/apiCache';

export const users = writable<User[]>([]);

export async function fetchUsers() {
	try {
		const cachedFetch = wrapFetch(fetch);
		const response = await cachedFetch('/api/users');
		if (!response.ok) throw new Error('Failed to fetch users');
		const data: User[] = await response.json();
		users.set(data);
	} catch (error) {
		console.error('Error fetching users:', error);
	}
}
