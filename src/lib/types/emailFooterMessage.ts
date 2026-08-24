export type EmailFooterMessage = {
	id?: number;
	message: string;
	active?: boolean;
	createdAt?: string | null;
	updatedAt?: string | null;
};

export type EmailFooterMessagePayload = {
	message: string;
	active?: boolean;
};
