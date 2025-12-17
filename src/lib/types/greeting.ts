export type GreetingAudience = 'client' | 'user' | 'both';

export type Greeting = {
	id?: number;
	message: string;
	icon?: string | null;
	active?: boolean;
	audience?: GreetingAudience;
	createdAt?: string | null;
	updatedAt?: string | null;
};

export type GreetingPayload = {
	message: string;
	icon?: string | null;
	active?: boolean;
	audience?: GreetingAudience;
};
