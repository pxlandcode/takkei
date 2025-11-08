import { get } from 'svelte/store';
import { user } from '$lib/stores/userStore';
import type { User } from '$lib/types/userTypes';

function normalizeRoleName(role?: string | null) {
	return typeof role === 'string' ? role.trim().toLowerCase() : '';
}

function collectUserRoles(targetUser?: User | null) {
	if (!targetUser) return [];

	const normalized: string[] = [];

	if (Array.isArray(targetUser.roles)) {
		for (const role of targetUser.roles as Array<{ name?: string } | string>) {
			if (!role) continue;
			const name = typeof role === 'string' ? role : role.name;
			const normalizedName = normalizeRoleName(name);
			if (normalizedName) normalized.push(normalizedName);
		}
	}

	const singleRole = normalizeRoleName(targetUser.role);
	if (singleRole) normalized.push(singleRole);

	return Array.from(new Set(normalized));
}

export function hasRole(required: string | string[], targetUser?: User | null): boolean {
	if (!required) return false;

	const currentUser = targetUser ?? get(user);
	const roles = collectUserRoles(currentUser);
	if (roles.length === 0) return false;

	const requiredRoles = Array.isArray(required) ? required : [required];
	return requiredRoles
		.map((role) => normalizeRoleName(role))
		.filter(Boolean)
		.some((role) => roles.includes(role));
}
