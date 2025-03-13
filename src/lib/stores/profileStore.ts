import { get, writable } from 'svelte/store';
import type { User } from '$lib/types/userTypes';
import type { FullBooking } from '$lib/types/calendarTypes';
import { fetchUser } from '$lib/services/api/userService';

/**
 * Type for the Profile Store
 */
type ProfileStoreData = {
	users: Record<number, { user: User; bookingsShort: FullBooking[] }>;
};

const createProfileStore = () => {
	const { subscribe, set, update } = writable<ProfileStoreData>({
		users: {} // Store multiple users by their ID
	});

	/**
	 * Fetch User Details and Bookings Using `userService`
	 */
	async function loadUser(trainerId: number, fetchFn: typeof fetch) {
		const data = await fetchUser(trainerId, fetchFn);

		if (data) {
			update((store) => {
				const newUsers = { ...store.users, [trainerId]: data };

				return { ...store, users: newUsers };
			});
		} else {
			console.error(`[profileStore] Failed to fetch user with ID: ${trainerId}`);
		}
	}

	/**
	 * Get a User from the Store
	 */
	function getUser(trainerId: number): User | null {
		return get(profileStore).users[trainerId]?.user || null;
	}

	/**
	 * Get a User's Bookings from the Store
	 */
	function getBookings(trainerId: number): FullBooking[] {
		return get(profileStore).users[trainerId]?.bookings || [];
	}

	/**
	 * Reset the store (clear all users & bookings)
	 */
	function reset() {
		set({ users: {} });
	}

	return {
		subscribe,
		loadUser,
		getUser,
		getBookings,
		reset
	};
};

// Export the store
export const profileStore = createProfileStore();
