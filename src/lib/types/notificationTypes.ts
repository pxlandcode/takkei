export enum AppNotificationType {
	SUCCESS = 'success',
	CANCEL = 'cancel',
	NOTE = 'note'
}

export interface AppNotification {
	type: AppNotificationType;
	message: string;
	description: string;
	timeout?: number;
	id?: string;
}
