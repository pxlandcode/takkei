export interface EventInfo {
	name: string;
	user_ids: number[];
	start_time?: string | Date;
	end_time?: string | Date;
	notify_at?: string;
	description?: string;
	active?: boolean;
	done?: boolean;
	repeat_yearly?: boolean;
	repeat_monthly?: boolean;
	repeat_weekly?: boolean;
	repeat_of_id?: number | null;
	shared_event_ids?: number[];
	personal?: boolean;
}

export interface CreateEventResponse {
	message: string;
	eventId: number;
}
