import {
	normalizeBookingContentIcon,
	resolveBookingContentIcon,
	type BookingContentIcon
} from '$lib/helpers/bookingContentIcons';
import type { BookingContent, BookingContentPayload } from '$lib/types/bookingContent';

export type BookingContentRow = {
	id: number | string;
	kind: string | null;
	icon?: string | null;
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

export function mapBookingContentRow(row: BookingContentRow): BookingContent {
	const kind = (row.kind ?? '').trim();
	return {
		id: Number(row.id),
		kind,
		icon: resolveBookingContentIcon({ icon: row.icon, kind }),
		active: row.active == null ? true : Boolean(row.active),
		bookingsCount: row.bookings_count == null ? undefined : Number(row.bookings_count),
		createdAt: toIso(row.created_at),
		updatedAt: toIso(row.updated_at)
	};
}

export function validateBookingContentPayload(body: Record<string, unknown>): {
	errors: Record<string, string>;
	values: BookingContentPayload & { icon: BookingContentIcon; active: boolean };
} {
	const kind = typeof body.kind === 'string' ? body.kind.trim() : '';
	const icon = normalizeBookingContentIcon(body.icon) ?? null;
	const active = normalizeBoolean(body.active, true);
	const errors: Record<string, string> = {};

	if (!kind) {
		errors.kind = 'Namn krävs';
	}

	if (!icon) {
		errors.icon = 'Välj en giltig ikon';
	}

	return {
		errors,
		values: {
			kind,
			icon: icon ?? 'Training',
			active
		}
	};
}
