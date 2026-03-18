import type { User } from '$lib/types/userTypes';
import { get, writable } from 'svelte/store';
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

export function getUserEmails(ids: number | number[]): string[] {
	const allUsers = get(users);
	if (!Array.isArray(allUsers) || allUsers.length === 0) return [];

	const idList = Array.isArray(ids) ? ids : [ids];

	return idList
		.map((id) => allUsers.find((user) => user.id === id)?.email)
		.filter((email): email is string => !!email);
}
