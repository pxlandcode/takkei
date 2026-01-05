export type HolidayPay = {
	userId: number;
	firstname?: string;
	lastname?: string;
	amount: number;
	createdAt: string | null;
	updatedAt: string | null;
};

export type HolidayPayUpdatePayload = {
	userId: number;
	amount: number;
};
