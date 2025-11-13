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
