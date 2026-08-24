export const BOOKING_CONTENT_ICON_VALUES = [
	'Training',
	'Dumbbell',
	'Gymnastics',
	'Mobility',
	'Running',
	'Trophy',
	'GraduationCap',
	'ShiningStar'
] as const;

export type BookingContentIcon = (typeof BOOKING_CONTENT_ICON_VALUES)[number];

export function normalizeBookingContentIcon(value: unknown): BookingContentIcon | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return BOOKING_CONTENT_ICON_VALUES.includes(trimmed as BookingContentIcon)
		? (trimmed as BookingContentIcon)
		: null;
}

export function fallbackBookingContentIcon(kind?: string | null): BookingContentIcon {
	const normalized = (kind ?? '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();

	if (normalized.includes('gymnastics') || normalized.includes('gymnastik')) return 'Gymnastics';
	if (normalized.includes('mobility') || normalized.includes('mobilitet')) return 'Mobility';
	return 'Training';
}

export function resolveBookingContentIcon(input: {
	icon?: unknown;
	kind?: string | null;
}): BookingContentIcon {
	return normalizeBookingContentIcon(input.icon) ?? fallbackBookingContentIcon(input.kind);
}
