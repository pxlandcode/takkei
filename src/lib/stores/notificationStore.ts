import { writable } from 'svelte/store';
import { wrapFetch } from '$lib/services/api/apiCache';

type NotificationType = 'alert' | 'client' | 'info';

export type NotificationSummary = {
	total: number;
	byType: Record<NotificationType, number>;
};

const createNotificationStore = () => {
	const { subscribe, set } = writable<NotificationSummary>({
		total: 0,
		byType: {
			alert: 0,
			client: 0,
			info: 0
		}
	});

	return {
		subscribe,

		async updateFromServer(userId: number) {
			if (!userId) return;

			try {
				const res = await wrapFetch(fetch)(`/api/notifications?user_id=${userId}`);
				if (!res.ok) throw new Error('Kunde inte hämta notifikationer');
				const notifications = await res.json();

				const byType = {
					alert: 0,
					client: 0,
					info: 0
				};

				for (const n of notifications) {
					const type = (n.event_type ?? 'info') as NotificationType;
					if (byType[type] !== undefined) byType[type]++;
				}

				set({
					total: notifications.length,
					byType
				});
			} catch (e) {
				console.error('notificationStore.updateFromServer failed:', e);
			}
		}
	};
};

export const notificationStore = createNotificationStore();
