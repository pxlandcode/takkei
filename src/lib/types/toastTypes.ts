export enum AppToastType {
	SUCCESS = 'success',
	CANCEL = 'cancel',
	NOTE = 'note'
}

export interface AppToasts {
	type: AppToastType;
	message: string;
	description: string;
	timeout?: number;
	id?: string;
}
