import { writable } from 'svelte/store';

interface LoadingState {
	isLoading: boolean;
	isSlowlyLoading: boolean;
	loadingText: string;
}

function createLoadingStore() {
	const { subscribe, set, update } = writable({
		isLoading: false,
		isSlowlyLoading: false,
		loadingText: ''
	});

	let timeout: number | undefined;

	function loading(isLoading: boolean, loadingText: string = ''): void {
		if (isLoading) {
			set({
				isLoading: true,
				isSlowlyLoading: false,
				loadingText: loadingText
			});
			console.log('Loading started:', loadingText);

			clearTimeout(timeout);

			timeout = window.setTimeout(() => {
				update((state) => {
					if (state.isLoading) {
						return { ...state, isSlowlyLoading: true };
					}
					return state;
				});
			}, 1000);
		} else {
			clearTimeout(timeout);
			set({
				isLoading: false,
				isSlowlyLoading: false,
				loadingText: ''
			});
		}
	}

	return {
		subscribe,
		loading
	};
}

export const loadingStore = createLoadingStore();
