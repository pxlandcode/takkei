import type { User } from '$lib/types/userTypes';
import { writable } from 'svelte/store';

export const users = writable<User[]>([]);

export async function fetchUsers() {
	try {
		const response = await fetch('/api/users');
		if (!response.ok) throw new Error('Failed to fetch users');
		const data: User[] = await response.json();
		users.set(data);
	} catch (error) {
		console.error('Error fetching users:', error);
	}
}
