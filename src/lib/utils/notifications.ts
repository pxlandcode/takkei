export type NotificationLike = {
	id?: number | null;
	event_type?: string | null;
	start_time?: string | null;
	created_at?: string | null;
};

function toTimestamp(value?: string | null) {
	if (!value) return null;

	const timestamp = new Date(value).getTime();
	return Number.isNaN(timestamp) ? null : timestamp;
}

export function getNotificationDisplayStart<
	T extends Pick<NotificationLike, 'start_time' | 'created_at'>
>(notification: T) {
	return notification.start_time ?? notification.created_at ?? null;
}

export function sortNotifications<T extends NotificationLike>(notifications: T[]) {
	return [...notifications].sort((left, right) => {
		const leftIsAlert = left.event_type === 'alert';
		const rightIsAlert = right.event_type === 'alert';

		if (leftIsAlert !== rightIsAlert) {
			return leftIsAlert ? -1 : 1;
		}

		const leftPrimary = toTimestamp(getNotificationDisplayStart(left));
		const rightPrimary = toTimestamp(getNotificationDisplayStart(right));

		if (leftPrimary !== rightPrimary) {
			if (leftPrimary === null) return 1;
			if (rightPrimary === null) return -1;
			return rightPrimary - leftPrimary;
		}

		const leftCreated = toTimestamp(left.created_at);
		const rightCreated = toTimestamp(right.created_at);

		if (leftCreated !== rightCreated) {
			if (leftCreated === null) return 1;
			if (rightCreated === null) return -1;
			return rightCreated - leftCreated;
		}

		return (right.id ?? 0) - (left.id ?? 0);
	});
}
