import { query } from '$lib/db';

type RoleLike = { name?: string } | string;

type AdminRequestContext =
	| { ok: true; authUser: any; roleAwareUser: any }
	| { ok: false; status: 401 | 403; message: string };

function collectRoleNames(user: { roles?: RoleLike[] | null; role?: string | null } | null | undefined) {
	const names = new Set<string>();

	if (Array.isArray(user?.roles)) {
		for (const role of user.roles) {
			const rawName = typeof role === 'string' ? role : role?.name;
			if (typeof rawName === 'string' && rawName.trim()) {
				names.add(rawName.trim().toLowerCase());
			}
		}
	}

	if (typeof user?.role === 'string' && user.role.trim()) {
		names.add(user.role.trim().toLowerCase());
	}

	return names;
}

export function hasAdministratorRole(
	user: { roles?: RoleLike[] | null; role?: string | null } | null | undefined
) {
	return collectRoleNames(user).has('administrator');
}

export async function resolveAdministratorRequest(locals: { user?: any | null }): Promise<AdminRequestContext> {
	const authUser = locals?.user ?? null;
	if (!authUser) {
		return { ok: false, status: 401, message: 'Unauthorized' };
	}

	let resolvedRoles: Array<{ name?: string } | string> = Array.isArray(authUser.roles)
		? authUser.roles
		: [];

	const trainerId =
		authUser.kind === 'trainer' ? authUser.trainerId ?? authUser.trainer_id ?? authUser.id ?? null : null;

	if (trainerId && resolvedRoles.length === 0) {
		try {
			resolvedRoles = await query('SELECT name FROM roles WHERE user_id = $1', [trainerId]);
		} catch (error) {
			console.warn('Failed to resolve admin roles', error);
		}
	}

	const roleAwareUser = {
		...authUser,
		roles: resolvedRoles
	};

	if (!hasAdministratorRole(roleAwareUser)) {
		return { ok: false, status: 403, message: 'Forbidden' };
	}

	return {
		ok: true,
		authUser,
		roleAwareUser
	};
}
