import type { CancellationReason, CancellationReasonPayload } from '$lib/types/cancellationReason';

export type CancellationReasonRow = {
	id: number | string;
	value: string | null;
	label: string | null;
	active?: boolean | null;
	bookings_count?: number | string | null;
	created_at?: string | Date | null;
	updated_at?: string | Date | null;
};

function toIso(value: string | Date | null | undefined) {
	if (!value) return null;
	if (value instanceof Date) return value.toISOString();
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function normalizeBoolean(value: unknown, fallback: boolean) {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'true') return true;
		if (normalized === 'false') return false;
	}
	return fallback;
}

export function mapCancellationReasonRow(row: CancellationReasonRow): CancellationReason {
	return {
		id: Number(row.id),
		value: (row.value ?? '').trim(),
		label: (row.label ?? '').trim(),
		active: row.active == null ? true : Boolean(row.active),
		bookingsCount: row.bookings_count == null ? undefined : Number(row.bookings_count),
		createdAt: toIso(row.created_at),
		updatedAt: toIso(row.updated_at)
	};
}

export function validateCancellationReasonPayload(body: Record<string, unknown>): {
	errors: Record<string, string>;
	values: CancellationReasonPayload & { active: boolean };
} {
	const label = typeof body.label === 'string' ? body.label.trim() : '';
	const active = normalizeBoolean(body.active, true);
	const errors: Record<string, string> = {};

	if (!label) {
		errors.label = 'Orsak krävs';
	}

	return {
		errors,
		values: {
			label,
			active
		}
	};
}

export function createCancellationReasonValue(label: string) {
	const normalized = label
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');

	return (normalized || 'Reason').slice(0, 240);
}
