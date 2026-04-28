export interface HomeModernNotificationEvent {
	id: number;
	name: string;
	description: string;
	event_type: string;
	start_time?: string | null;
	end_time?: string | null;
	created_at?: string | null;
	notify_at?: string | null;
	done?: boolean;
	created_by?: { name?: string } | null;
	link?: string | null;
}

export interface HomeModernClient {
	id: number;
	firstname: string;
	lastname: string;
	lastBookingDate?: string | null;
}

export interface HomeModernClientsWithoutBookingsResponse {
	thisWeek: HomeModernClient[];
	week1: HomeModernClient[];
	week2: HomeModernClient[];
}
