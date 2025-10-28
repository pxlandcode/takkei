import { writable } from 'svelte/store';

export type LocationRoom = {
        id: number;
        name: string;
        half_hour_start?: boolean | null;
        active?: boolean;
};

export type Location = {
        id: number;
        name: string;
        color?: string;
        rooms: LocationRoom[];
};

export const locations = writable<Location[]>([]);

export async function fetchLocations() {
        try {
                const response = await fetch('/api/locations');
                if (!response.ok) throw new Error('Failed to fetch locations');
                const data: Location[] = await response.json();
                locations.set(
                        data.map((location) => ({
                                ...location,
                                rooms: Array.isArray(location.rooms) ? location.rooms : []
                        }))
                );
        } catch (error) {
                console.error('Error fetching locations:', error);
        }
}
