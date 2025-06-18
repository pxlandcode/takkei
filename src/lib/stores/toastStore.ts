import type { AppToasts } from '$lib/types/toastTypes';
import { writable } from 'svelte/store';

export const toasts = writable<AppToasts[]>([]);

export function addToast(notification: Omit<AppToasts, 'id'>) {
	const id = crypto.randomUUID();
	toasts.update((all) => [...all, { ...notification, id, timeout: notification.timeout || 5000 }]);

	setTimeout(() => removeToast(id), notification.timeout || 5000);
}

export function removeToast(id: string) {
	toasts.update((all) => all.filter((n) => n.id !== id));
}
