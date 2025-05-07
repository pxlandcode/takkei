import { get } from 'svelte/store';
import { user } from '$lib/stores/userStore';

export function hasRole(required: string | string[]): boolean {
	const currentUser = get(user);
	const roles = currentUser?.roles?.map((r) => r.name) || [];

	if (!required) return false;

	if (Array.isArray(required)) {
		return required.some((role) => roles.includes(role));
	}

	return roles.includes(required);
}
