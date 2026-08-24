export type CancellationReason = {
	id: number;
	value: string;
	label: string;
	active: boolean;
	bookingsCount?: number;
	createdAt?: string | null;
	updatedAt?: string | null;
};

export type CancellationReasonPayload = {
	label: string;
	active?: boolean;
};
