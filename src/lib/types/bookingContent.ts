import type { BookingContentIcon } from '$lib/helpers/bookingContentIcons';

export type BookingContent = {
	id: number;
	kind: string;
	icon: BookingContentIcon;
	active: boolean;
	bookingsCount?: number;
	createdAt?: string | null;
	updatedAt?: string | null;
};

export type BookingContentPayload = {
	kind: string;
	icon?: BookingContentIcon;
	active?: boolean;
};
