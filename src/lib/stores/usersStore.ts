import type { User } from '$lib/types/userTypes';
import { get, writable } from 'svelte/store';
import { cacheFirstJson, invalidateByPrefix } from '$lib/services/api/apiCache';

export const users = writable<User[]>([]);

export async function fetchUsers(options: { force?: boolean } = {}) {
	const url = '/api/users';
	if (options.force) {
		invalidateByPrefix(url);
	}

	try {
		const { cached, fresh } = cacheFirstJson<User[]>(fetch, url);
		if (cached && !options.force) {
			users.set(cached);
		}

		const data = await fresh;
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
