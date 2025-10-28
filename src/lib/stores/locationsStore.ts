import { writable } from 'svelte/store';

export type LocationRoom = {
	id: number;
	name: string;
	active: boolean;
	halfHourStart: boolean;
};

export type Location = {
	id: number;
	name: string;
	color: string | null;
	rooms: LocationRoom[];
};

type ApiLocationRoom = {
	id: number;
	name: string;
	active: boolean;
	half_hour_start: boolean;
};

type ApiLocation = {
	id: number;
	name: string;
	color: string | null;
	rooms?: ApiLocationRoom[];
};

export const locations = writable<Location[]>([]);

export async function fetchLocations() {
	try {
		const response = await fetch('/api/locations');
		if (!response.ok) throw new Error('Failed to fetch locations');

		const data: ApiLocation[] = await response.json();

		const normalised: Location[] = data.map((location) => ({
			id: location.id,
			name: location.name,
			color: location.color ?? null,
			rooms: (location.rooms ?? []).map((room) => ({
				id: room.id,
				name: room.name,
				active: room.active,
				halfHourStart: room.half_hour_start ?? false
			}))
		}));

		locations.set(normalised);
	} catch (error) {
		console.error('Error fetching locations:', error);
	}
}
