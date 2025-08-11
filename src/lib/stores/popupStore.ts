// src/lib/stores/popupStore.ts
import { writable } from 'svelte/store';

export type PopupStoreType =
	| { type: 'mail'; header: string; data: MailPopupData }
	| { type: 'clientForm' }
	| { type: 'booking'; data?: { clientId?: number; trainerId?: number } }
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
