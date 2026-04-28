export type NotificationLike = {
	id?: number | null;
	event_type?: string | null;
	start_time?: string | null;
	end_time?: string | null;
	created_at?: string | null;
	notify_at?: string | null;
};

function toTimestamp(value?: string | null) {
	if (!value) return null;

	const timestamp = new Date(value).getTime();
	return Number.isNaN(timestamp) ? null : timestamp;
}

export function getNotificationDisplayStart<
	T extends Pick<
		NotificationLike,
		'start_time' | 'end_time' | 'created_at' | 'notify_at' | 'event_type'
	>
>(notification: T) {
	if (notification.notify_at === 'created_at') {
		return notification.created_at ?? notification.start_time ?? null;
	}

	if (notification.notify_at === 'three_days_before' && notification.start_time) {
		const timestamp = new Date(notification.start_time).getTime();
		if (!Number.isNaN(timestamp)) {
			return new Date(timestamp - 3 * 24 * 60 * 60 * 1000).toISOString();
		}
	}

	if (notification.event_type === 'client' || notification.event_type === 'article') {
		return notification.created_at ?? notification.start_time ?? null;
	}

	if (
		notification.notify_at === 'start_time' &&
		notification.start_time &&
		notification.end_time &&
		new Date(notification.end_time).getTime() <= new Date(notification.start_time).getTime()
	) {
		return notification.created_at ?? notification.start_time ?? null;
	}

	return notification.start_time ?? notification.created_at ?? null;
}

export function getNotificationEventStart<
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
