export interface BookingDetails {
	id: number;
	status: string; // "New", "Cancelled", etc.
	createdAt: string; // ISO date
	updatedAt: string; // ISO date
	startTime: string; // ISO date
	endTime?: string | null; // ISO date
	cancelTime?: string | null;
	actualCancelTime?: string | null;
	repeatIndex?: number | null;
	tryOut: boolean;
	refundComment?: string | null;
	cancelReason?: string | null;
	bookingWithoutRoom: boolean;
	internalEducation: boolean;
	userId?: number | string | null;
}

export interface Trainer {
	id: number;
	firstname: string;
	lastname: string;
}

export interface Client {
	id?: number | null;
	firstname: string;
	lastname: string;
	email?: string | null;
	phone?: string | null;
}

export interface RoomDetails {
	id: number;
	name: string;
}

export interface Location {
	id: number;
	name: string;
	color: string;
}

export interface BookingContent {
	id: number;
	kind: string;
}

export interface AdditionalInfo {
	packageId?: number | null;
	education: boolean;
	internal: boolean;
	bookingContent: BookingContent;
	addedToPackageBy?: string | null;
	addedToPackageDate?: string | null;
	actualCancelTime?: string | null;
}

export interface PersonalBookingInfo {
	name: string;
	text?: string;
	bookedById?: number | null;
	userIds: number[];
	kind: string;
}

export interface FullBooking {
	isPersonalBooking: boolean;
	booking: BookingDetails;
	trainer?: Trainer | null;
	client?: Client | null;
	trainee?: Trainer | null;
	room?: RoomDetails | null;
	location?: Location | null;
	additionalInfo?: AdditionalInfo | null;
	personalBooking?: PersonalBookingInfo | null;
}

export type BookingFilters = {
	from?: string | null; // Start date (YYYY-MM-DD)
	to?: string | null; // End date (YYYY-MM-DD)
	date?: string | null; // Single date (YYYY-MM-DD)
	roomId?: number | null;
	locationIds?: number[];
	trainerIds?: number[] | null;
	clientIds?: number[] | null;
	userIds?: number[] | null;
	forwardOnly?: boolean;
	sortAsc?: boolean;
	personalBookings?: boolean;
};
