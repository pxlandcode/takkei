export interface HomeModernNotificationEvent {
	id: number;
	name: string;
	description: string;
	event_type: string;
	start_time: string;
	end_time?: string | null;
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
