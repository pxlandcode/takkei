import { browser } from '$app/environment';
import type { AuthenticatedUser } from '$lib/types/userTypes';
import type { SignupOnboardingSummary } from '$lib/types/signupOnboarding';
import { writable } from 'svelte/store';

type State = SignupOnboardingSummary & {
	loading: boolean;
	available: boolean;
};

const emptyState: State = {
	pending: 0,
	loading: false,
	available: false
};

export function isAdministrator(user: AuthenticatedUser | null | undefined) {
	return (
		user?.kind === 'trainer' &&
		Array.isArray(user.roles) &&
		user.roles.some((role) => role.name?.trim().toLowerCase() === 'administrator')
	);
}

function createSignupOnboardingStore() {
	const { subscribe, set, update } = writable<State>(emptyState);
	let activeUserId: number | null = null;
	let interval: ReturnType<typeof setInterval> | null = null;
	let focusHandler: (() => void) | null = null;
	let request: Promise<void> | null = null;

	async function refresh() {
		if (!browser || !activeUserId) return;
		if (request) return request;

		update((state) => ({ ...state, loading: true }));
		request = fetch('/api/onboarding/summary', { cache: 'no-store' })
			.then(async (response) => {
				if (!response.ok) throw new Error('Kunde inte hämta registreringar');
				const summary = (await response.json()) as SignupOnboardingSummary;
				set({ ...summary, loading: false, available: true });
			})
			.catch((error) => {
				console.error('signupOnboardingStore.refresh failed:', error);
				update((state) => ({ ...state, loading: false }));
			})
			.finally(() => {
				request = null;
			});
		return request;
	}

	function stop() {
		activeUserId = null;
		if (interval) clearInterval(interval);
		interval = null;
		if (browser && focusHandler) window.removeEventListener('focus', focusHandler);
		focusHandler = null;
		set(emptyState);
	}

	function start(currentUser: AuthenticatedUser | null | undefined) {
		if (!browser || !currentUser || !isAdministrator(currentUser)) {
			stop();
			return;
		}
		if (activeUserId === currentUser.id) return;
		stop();
		activeUserId = currentUser.id;
		focusHandler = () => void refresh();
		window.addEventListener('focus', focusHandler);
		interval = setInterval(() => void refresh(), 60_000);
		void refresh();
	}

	return { subscribe, start, stop, refresh };
}

export const signupOnboardingStore = createSignupOnboardingStore();
