export interface BookingDetails {
	id: number;
	status: string; // "New", "Cancelled", etc.
	createdAt: string; // ISO date
	updatedAt: string; // ISO date
	startTime: string; // ISO date
	cancelTime?: string | null;
	repeatIndex?: number | null;
	tryOut: boolean;
	refundComment?: string | null;
	cancelReason?: string | null;
	bookingWithoutRoom: boolean;
	internalEducation: boolean;
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
}

export interface RoomDetails {
	id: number;
	name: string;
}

export interface Location {
	id: number;
	name: string;
}

export interface AdditionalInfo {
	packageId?: number | null;
	education: boolean;
	internal: boolean;
	bookingContentId: number;
	addedToPackageBy?: string | null;
	addedToPackageDate?: string | null;
	actualCancelTime?: string | null;
}

export interface FullBooking {
	booking: BookingDetails;
	trainer: Trainer;
	client: Client;
	room: RoomDetails;
	location: Location;
	additionalInfo: AdditionalInfo;
}
