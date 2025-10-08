import { writable } from 'svelte/store';
import type { ComponentType } from 'svelte';

export type PopupListeners = Record<string, (event: CustomEvent<any>) => void>;

export type PopupState = {
	id?: string;
	component: ComponentType;
	header?: string;
	icon?: string;
	props?: Record<string, unknown>;
	width?: string;
	height?: string;
	maxWidth?: string;
	maxHeight?: string;
	dismissable?: boolean;
	noClose?: boolean;
	closeOn?: string[];
	listeners?: PopupListeners;
};

const DEFAULT_CLOSE_ON: string[] = [];

export const popupStore = writable<PopupState | null>(null);

export function openPopup(config: PopupState) {
	popupStore.set({
		...config,
		closeOn: config.closeOn ?? DEFAULT_CLOSE_ON
	});
}

export function closePopup() {
	popupStore.set(null);
}
