import type { AppNotification } from '$lib/types/notificationTypes';
import { writable } from 'svelte/store';

export const notifications = writable<AppNotification[]>([]);

export function addNotification(notification: Omit<AppNotification, 'id'>) {
    const id = Date.now().toString();
    notifications.update((all) => [
        ...all,
        { ...notification, id, timeout: notification.timeout || 5000 },
    ]);

    setTimeout(() => removeNotification(id), notification.timeout || 5000);
}

export function removeNotification(id: string) {
    notifications.update((all) => all.filter((n) => n.id !== id));
}
