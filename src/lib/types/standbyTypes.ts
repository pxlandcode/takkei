export type StandbyDisplayTrainer = {
	id: number;
	firstname: string;
	lastname: string;
	email: string | null;
	active?: boolean | null;
};

export type StandbyDisplayClient = {
	id: number;
	firstname: string;
	lastname: string;
	email: string | null;
	active?: boolean | null;
};

export type StandbyDisplayLocation = {
	id: number;
	name: string;
	color: string | null;
};

export type StandbyAvailableStart = {
	locationId: number;
	locationName: string;
	startTime: string;
	date: string;
	time: string;
};

export type StandbyWarnings = {
	availableStarts: StandbyAvailableStart[];
};

export type StandbyTimeRecord = {
	id: number;
	ownerTrainerId: number | null;
	clientId: number | null;
	locationIds: number[];
	trainerIds: number[];
	comment: string | null;
	wantedStartTime: string;
	wantedEndTime: string;
	date: string;
	startTime: string;
	endTime: string;
	createdAt: string;
	updatedAt: string;
	owner: StandbyDisplayTrainer | null;
	client: StandbyDisplayClient | null;
	locations: StandbyDisplayLocation[];
	trainers: StandbyDisplayTrainer[];
	expired: boolean;
	isOwner: boolean;
	isVisibleRecipient: boolean;
};

export type StandbyMutationPayload = {
	clientId?: number | null;
	locationIds: number[];
	trainerIds: number[];
	date: string;
	startTime: string;
	endTime: string;
	comment?: string | null;
};

export type StandbyMutationResponse = {
	standbyTime: StandbyTimeRecord;
	warnings: StandbyWarnings;
};
