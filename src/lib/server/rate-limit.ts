const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

type Entry = {
        count: number;
        expiresAt: number;
};

const attempts = new Map<string, Entry>();

export function consumeAttempt(key: string) {
        const now = Date.now();
        const existing = attempts.get(key);

        if (existing && existing.expiresAt <= now) {
                attempts.delete(key);
        }

        const entry = attempts.get(key);
        if (!entry) {
                attempts.set(key, { count: 1, expiresAt: now + WINDOW_MS });
                return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfter: 0 } as const;
        }

        if (entry.count >= MAX_ATTEMPTS) {
                return {
                        allowed: false,
                        remaining: 0,
                        retryAfter: Math.ceil((entry.expiresAt - now) / 1000)
                } as const;
        }

        entry.count += 1;
        return {
                allowed: true,
                remaining: Math.max(0, MAX_ATTEMPTS - entry.count),
                retryAfter: Math.ceil((entry.expiresAt - now) / 1000)
        } as const;
}

export function resetAttempts(key: string) {
        attempts.delete(key);
}
