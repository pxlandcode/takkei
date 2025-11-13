import { query } from '$lib/db';

export function isAdministrator(user: any): boolean {
        if (!user) return false;
        const names: string[] = [];
        if (Array.isArray(user.roles)) {
                for (const role of user.roles) {
                        if (!role) continue;
                        const name = typeof role === 'string' ? role : role.name;
                        if (typeof name === 'string') {
                                names.push(name.toLowerCase());
                        }
                }
        }
        if (typeof user.role === 'string') {
                names.push(user.role.toLowerCase());
        }
        return names.includes('administrator');
}

export async function resolveUserWithRoles(locals: App.Locals) {
        const authUser = locals.user;
        if (!authUser) return { authUser: null, roleAwareUser: null };

        const trainerId =
                authUser.kind === 'trainer'
                        ? authUser.trainerId ?? authUser.trainer_id ?? null
                        : null;

        let resolvedRoles: Array<{ name?: string } | string> = Array.isArray(authUser.roles)
                ? authUser.roles
                : [];

        if (trainerId && resolvedRoles.length === 0) {
                try {
                        resolvedRoles = await query('SELECT name FROM roles WHERE user_id = $1', [trainerId]);
                } catch (roleError) {
                        console.warn('Failed to resolve user roles for settings API', roleError);
                }
        }

        const roleAwareUser = {
                ...authUser,
                roles: resolvedRoles
        };

        return { authUser, roleAwareUser };
}

export function json(data: unknown, status = 200) {
        return new Response(JSON.stringify(data), {
                status,
                headers: { 'content-type': 'application/json' }
        });
}
