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
                        console.warn('Failed to resolve user roles for OB time windows', roleError);
                }
        }

        const roleAwareUser = {
                ...authUser,
                roles: resolvedRoles
        };

        return { authUser, roleAwareUser };
}

function parseBoolean(value: unknown, fallback: boolean) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
                const normalized = value.trim().toLowerCase();
                if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
                if (['false', '0', 'no', 'off'].includes(normalized)) return false;
        }
        return fallback;
}

export function normalizePayload(payload: Record<string, unknown>) {
        const errors: Record<string, string> = {};

        const name = typeof payload.name === 'string' ? payload.name.trim() : '';
        if (!name) {
                errors.name = 'Namn krävs';
        }

        const startRaw = payload.start_minutes ?? payload.startMinutes;
        const endRaw = payload.end_minutes ?? payload.endMinutes;
        const start = Number(startRaw);
        const end = Number(endRaw);

        if (!Number.isFinite(start) || start < 0 || start > 1439) {
                errors.start_minutes = 'Starttid måste vara mellan 00:00 och 23:59';
        }

        if (!Number.isFinite(end) || end <= 0 || end > 1440) {
                errors.end_minutes = 'Sluttid måste vara mellan 00:01 och 24:00';
        }

        if (!errors.start_minutes && !errors.end_minutes && !(start < end)) {
                errors.end_minutes = 'Sluttid måste vara senare än starttid';
        }

        const maskRaw = payload.weekday_mask ?? payload.weekdayMask;
        const weekdayMask = Number(maskRaw);
        if (!Number.isFinite(weekdayMask) || weekdayMask < 0 || weekdayMask > 127) {
                errors.weekday_mask = 'Ogiltig veckodagsmask';
        }

        const includeHolidays = parseBoolean(payload.include_holidays ?? payload.includeHolidays, false);
        const active = parseBoolean(payload.active ?? true, true);

        return {
                errors,
                values: {
                        name,
                        start_minutes: Number.isFinite(start) ? start : null,
                        end_minutes: Number.isFinite(end) ? end : null,
                        weekday_mask: Number.isFinite(weekdayMask) ? weekdayMask : null,
                        include_holidays: includeHolidays,
                        active
                }
        };
}

export function json(data: unknown, status = 200) {
        return new Response(JSON.stringify(data), {
                status,
                headers: { 'content-type': 'application/json' }
        });
}
