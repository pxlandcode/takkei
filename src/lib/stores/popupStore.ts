import { writable } from 'svelte/store';
import type { ComponentType } from 'svelte';

export type PopupListeners = Record<string, (event: CustomEvent<any>) => void>;

export type PopupState = {
	id?: string;
	component: ComponentType;
	header?: string;
	icon?: string;
	variant?: 'modal' | 'right' | 'left' | 'top' | 'bottom';
	props?: Record<string, unknown>;
	width?: string;
	height?: string;
	maxWidth?: string;
	maxHeight?: string;
	dismissable?: boolean;
	noClose?: boolean;
	closeOn?: string[];
	listeners?: PopupListeners;
	draggable?: boolean;
	minimizable?: boolean;
	position?: { x: number; y: number };
};

export type MinimizedPopup = PopupState & {
	id: string;
};

const DEFAULT_CLOSE_ON: string[] = [];

export const popupStore = writable<PopupState | null>(null);
export const minimizedPopups = writable<MinimizedPopup[]>([]);

let nextPopupId = 1;

export function openPopup(config: PopupState) {
	const id = config.id ?? `popup-${nextPopupId++}`;
	popupStore.set({
		...config,
		id,
		closeOn: config.closeOn ?? DEFAULT_CLOSE_ON,
		draggable: config.draggable ?? true,
		minimizable: config.minimizable ?? true
	});
}

export function closePopup() {
	popupStore.set(null);
}

export function minimizePopup(popup: PopupState) {
	if (!popup.id) return;

	minimizedPopups.update((popups) => {
		// Don't add duplicate
		if (popups.some((p) => p.id === popup.id)) {
			return popups;
		}
		return [...popups, popup as MinimizedPopup];
	});

	popupStore.set(null);
}

export function restorePopup(id: string) {
	minimizedPopups.update((popups) => {
		const popup = popups.find((p) => p.id === id);
		if (popup) {
			popupStore.set(popup);
			return popups.filter((p) => p.id !== id);
		}
		return popups;
	});
}

export function removeMinimizedPopup(id: string) {
	minimizedPopups.update((popups) => popups.filter((p) => p.id !== id));
}
