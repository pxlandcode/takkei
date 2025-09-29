// src/lib/stores/popupStore.ts
import { writable } from 'svelte/store';
import type { FullBooking } from '$lib/types/calendarTypes';

export type PopupStoreType =
	| { type: 'mail'; header: string; data: MailPopupData }
	| { type: 'clientForm' }
	| { type: 'booking'; data?: { clientId?: number; trainerId?: number } }
	| { type: 'bookingDetails'; data: { booking: FullBooking } }
	| null;
type MailPopupData = {
	prefilledRecipients?: string[];
	subject?: string;
	header?: string;
	subheader?: string;
	body?: string;
	lockedFields?: string[];
	autoFetchUsersAndClients?: boolean;
};

export const popupStore = writable<PopupStoreType>(null);
