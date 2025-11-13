import { query } from '$lib/db';
import type { AuthenticatedUser, Role, User } from '$lib/types/userTypes';

export type RoleAwareUser = (AuthenticatedUser & { roles?: Array<{ name?: string } | string> }) | null;

function isTrainer(user: AuthenticatedUser): user is User {
	return user.kind === 'trainer';
}

export async function resolveRoleAwareUser(user: AuthenticatedUser | null): Promise<RoleAwareUser> {
	if (!user) return null;

	let resolvedRoles: Array<{ name?: string } | string> = Array.isArray(user.roles) ? user.roles : [];

	if (resolvedRoles.length === 0 && isTrainer(user)) {
		const trainerId = user.trainerId ?? user.trainer_id ?? null;
		if (typeof trainerId === 'number') {
			try {
				resolvedRoles = await query<Role>('SELECT name FROM roles WHERE user_id = $1', [trainerId]);
			} catch (error) {
				console.warn('Failed to resolve roles for user', trainerId, error);
			}
		}
	}

	return { ...user, roles: resolvedRoles };
}
