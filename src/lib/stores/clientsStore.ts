import { get, writable } from 'svelte/store';

export type Trainer = {
	id: number;
	firstname: string;
	lastname: string;
};

export type Client = {
	id: number;
	firstname: string;
	lastname: string;
	email: string | null;
	phone: string | null;
	isActive: boolean;
	primary_location_id?: number | null;
	primary_location?: string | null;
	trainer?: Trainer | null;
};

export const clients = writable<Client[]>([]);

export async function fetchClients() {
	try {
		const response = await fetch('/api/clients');
		if (!response.ok) throw new Error('Failed to fetch clients');

		const data = await response.json();

		// Transform API response to match the updated Client type
		const formattedClients: Client[] = data.map((client: any) => ({
			id: client.id,
			firstname: client.firstname,
			lastname: client.lastname,
			email: client.email,
			phone: client.phone,
			isActive: client.active,
			primary_location_id: client.primary_location_id ?? null,
			primary_location: client.primary_location ?? null,
			trainer: client.trainer_id
				? {
						id: client.trainer_id,
						firstname: client.trainer_firstname,
						lastname: client.trainer_lastname
					}
				: null
		}));

		clients.set(formattedClients);
	} catch (error) {
		console.error('Error fetching clients:', error);
	}
}

export async function fetchTrialEligibleClients({
	trainerId,
	lookbackDays = 365,
	short = false, // IMPORTANT: default false to get trainer fields
	limit = 200
}: { trainerId?: number; lookbackDays?: number; short?: boolean; limit?: number } = {}) {
	const qs = new URLSearchParams({
		trialEligible: 'true',
		trialLookbackDays: String(lookbackDays),
		short: String(short),
		limit: String(limit)
	});
	if (trainerId) qs.set('trainerId', String(trainerId));

	const res = await fetch(`/api/clients?${qs.toString()}`);
	if (!res.ok) throw new Error('Failed to fetch trial-eligible clients');
	const data = await res.json();

	const formatted: Client[] = data.map((client: any) => ({
		id: client.id,
		firstname: client.firstname,
		lastname: client.lastname,
		email: client.email,
		phone: client.phone,
		isActive: client.active,
		primary_location_id: client.primary_location_id ?? null,
		primary_location: client.primary_location ?? null,
		trainer: client.trainer_id
			? {
					id: client.trainer_id,
					firstname: client.trainer_firstname,
					lastname: client.trainer_lastname
				}
			: null
	}));
	return formatted;
}

export function getClientEmails(ids: number | number[]): string[] {
	const allClients = get(clients);
	if (!Array.isArray(allClients) || allClients.length === 0) return [];

	const idList = Array.isArray(ids) ? ids : [ids];

	return idList
		.map((id) => allClients.find((c) => c.id === id)?.email)
		.filter((email): email is string => !!email); // Removes undefined/null
}
