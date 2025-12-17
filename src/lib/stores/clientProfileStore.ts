import { get, writable } from 'svelte/store';

import type { FullBooking } from '$lib/types/calendarTypes';
import type { Client } from '$lib/types/clientTypes';
import { fetchClient } from '$lib/services/api/clientService';

/**
 * Type for the Client Profile Store
 */
type ClientProfileStoreData = {
	clients: Record<number, { client: Client; bookingsShort: FullBooking[] }>;
};

const createClientProfileStore = () => {
	const { subscribe, set, update } = writable<ClientProfileStoreData>({
		clients: {} // Store multiple clients by their ID
	});

	/**
	 * Fetch Client Details Using `clientService`
	 */
	async function loadClient(clientId: number, fetchFn: typeof fetch) {
		const data = await fetchClient(clientId, fetchFn);

		if (data) {
			update((store) => {
				const newClients = {
					...store.clients,
					[clientId]: { client: data.client, bookingsShort: data.bookings }
				};
				return { ...store, clients: newClients };
			});
		} else {
			console.error(`[clientProfileStore] Failed to fetch client with ID: ${clientId}`);
		}
	}

	/**
	 * Fetch Client's Bookings Using `bookingService`
	 */
	// async function loadClientBookings(clientId: number, fetchFn: typeof fetch) {
	// 	const data = await fetchBookings({ clientIds: [clientId] }, fetchFn);

	// 	if (data) {
	// 		update((store) => {
	// 			if (store.clients[clientId]) {
	// 				store.clients[clientId].bookingsShort = data;
	// 			}
	// 			return store;
	// 		});
	// 	} else {
	// 		console.error(`[clientProfileStore] Failed to fetch bookings for client ID: ${clientId}`);
	// 	}
	// }

	/**
	 * Get a Client from the Store
	 */
	function getClient(clientId: number): Client | null {
		return get(clientProfileStore).clients[clientId]?.client || null;
	}

	/**
	 * Get a Client's Bookings from the Store
	 */
	function getBookings(clientId: number): FullBooking[] {
		return get(clientProfileStore).clients[clientId]?.bookingsShort || [];
	}

	/**
	 * Reset the store (clear all clients & bookings)
	 */
	function reset() {
		set({ clients: {} });
	}

	return {
		subscribe,
		loadClient,
		getClient,
		getBookings,
		reset
	};
};

// Export the store
export const clientProfileStore = createClientProfileStore();
