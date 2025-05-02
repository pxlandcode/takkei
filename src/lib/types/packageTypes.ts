export type NewPackagePayload = {
	customerId: number;
	clientId?: number;
	articleId: number;
	price: number;
	firstPaymentDate: string;
	invoiceNumber?: string;
	autogiro: boolean;
	installments: number;
};

export type Package = {
	id: number;
	article: {
		id: number;
		name: string;
		sessions: number;
	};
	client?: {
		id: number;
		firstname: string;
		lastname: string;
	};
	customer: {
		id: number;
		name: string;
	};
	paid_price: number;
	first_payment_date: string;
	autogiro: boolean;
	invoice_numbers?: string[];
	installments: { date: string; sum: number }[];
	frozen: boolean;
};
