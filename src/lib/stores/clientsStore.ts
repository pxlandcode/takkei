import { get, writable } from 'svelte/store';
import { cacheFirstJson, wrapFetch } from '$lib/services/api/apiCache';

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
	gdpr_deleted_at?: string | null;
	gdpr_delete_token?: string | null;
	merged_into_client_id?: number | null;
	primary_location_id?: number | null;
	primary_location?: string | null;
	trainer?: Trainer | null;
};

export const clients = writable<Client[]>([]);

function formatClients(data: any[]): Client[] {
	return data.map((client: any) => ({
		id: client.id,
		firstname: client.firstname,
		lastname: client.lastname,
		email: client.email,
		phone: client.phone,
		isActive: client.active,
		gdpr_deleted_at: client.gdpr_deleted_at ?? null,
		gdpr_delete_token: client.gdpr_delete_token ?? null,
		merged_into_client_id: client.merged_into_client_id ?? null,
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
}

export async function fetchClients() {
	try {
		const { cached, fresh } = cacheFirstJson<any[]>(fetch, '/api/clients');
		if (cached) clients.set(formatClients(cached));

		const data = await fresh;
		clients.set(formatClients(data));
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

	const res = await wrapFetch(fetch)(`/api/clients?${qs.toString()}`);
	if (!res.ok) throw new Error('Failed to fetch trial-eligible clients');
	const data = await res.json();

	return formatClients(data);
}

export function getClientEmails(ids: number | number[]): string[] {
	const allClients = get(clients);
	if (!Array.isArray(allClients) || allClients.length === 0) return [];

	const idList = Array.isArray(ids) ? ids : [ids];

	return idList
		.map((id) => allClients.find((c) => c.id === id)?.email)
		.filter((email): email is string => !!email); // Removes undefined/null
}
