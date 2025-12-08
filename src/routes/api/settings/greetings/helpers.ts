import type { Greeting } from '$lib/types/greeting';

type NormalizedGreeting = {
	message: string;
	icon: string | null;
	active: boolean;
};

export type GreetingValidationResult = {
	errors: Record<string, string>;
	values: NormalizedGreeting;
};

function normalizeString(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value.trim();
}

function normalizeIcon(value: unknown): string | null {
	const icon = normalizeString(value);
	return icon === '' ? null : icon;
}

function normalizeActive(value: unknown): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
		if (['false', '0', 'no', 'off'].includes(normalized)) return false;
	}
	return true; // default to active
}

export function validateGreetingPayload(payload: Record<string, unknown>): GreetingValidationResult {
	const errors: Record<string, string> = {};

	const message = normalizeString(payload.message);
	if (!message) {
		errors.message = 'Meddelande krävs';
	}

	const icon = normalizeIcon(payload.icon);
	const active = normalizeActive(payload.active);

	return {
		errors,
		values: { message, icon, active }
	};
}

export type GreetingRow = {
	id: number;
	message: string;
	icon: string | null;
	active: boolean;
	created_at: string | null;
	updated_at: string | null;
};

function toIso(value: string | null): string | null {
	if (!value) return null;
	const parsed = new Date(value);
	if (!Number.isNaN(parsed.getTime())) {
		return parsed.toISOString();
	}
	return value;
}

export function mapGreetingRow(row: GreetingRow): Greeting {
	return {
		id: Number(row.id),
		message: normalizeString(row.message),
		icon: row.icon ? String(row.icon) : null,
		active: Boolean(row.active),
		createdAt: toIso(row.created_at),
		updatedAt: toIso(row.updated_at)
	};
}
