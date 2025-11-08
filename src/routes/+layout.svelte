<script lang="ts">
	import { i18n } from '$lib/i18n';
	import { ParaglideJS } from '@inlang/paraglide-sveltekit';
	import { user } from '$lib/stores/userStore';
	import { page } from '$app/stores';
	import { navigating } from '$app/state';
	import '../app.css';

	import LoadingOverlay from '../components/ui/loadingOverlay/LoadingOverlay.svelte';
	import Dashboard from '../components/view/dashboard/Dashboard.svelte';
	import ToastContainer from '../components/ui/toast-container/ToastContainer.svelte';

import { onMount } from 'svelte';
import { browser, dev } from '$app/environment';
	import { goto } from '$app/navigation';
import Button from '../components/bits/button/Button.svelte';
import PopupWrapper from '../components/ui/popupWrapper/PopupWrapper.svelte';
import PopupContentHost from '../components/ui/popupWrapper/PopupContentHost.svelte';

import { popupStore, closePopup, type PopupState } from '$lib/stores/popupStore';
import { get } from 'svelte/store';
	import { loadingStore } from '$lib/stores/loading';

export let data;
	$user = data.user;

let isMobile = false;
let showDrawer = false;

let popup: PopupState | null = null;
let popupListeners: Record<string, (event: CustomEvent<any>) => void> = {};
let popupProps: Record<string, unknown> = {};

$: currentRoute = $page.url.pathname;

$: navigating.to && loadingStore.loading(!!navigating.to);

	// Detect mobile and route changes
	onMount(() => {
		if (!browser) {
			return;
		}

		if ('serviceWorker' in navigator && !dev) {
			navigator.serviceWorker
				.register('/service-worker.js')
				.catch((error) => console.error('Service worker registration failed', error));
		}

		isMobile = window.innerWidth < 768;
		showDrawer = isMobile && currentRoute !== '/';
	});

	page.subscribe(($page) => {
		if (browser && isMobile) {
			showDrawer = $page.url.pathname !== '/';
		}
	});

function closeDrawer() {
	showDrawer = false;
	goto('/');
}

function buildListeners(state: PopupState | null) {
	if (!state) return {};
	const listeners: Record<string, (event: CustomEvent<any>) => void> = {};
	const rawListeners = state.listeners ?? {};

	for (const [eventName, handler] of Object.entries(rawListeners)) {
		if (eventName === 'close') continue;
		listeners[eventName] = handler;
	}

	const closeEvents = (state.closeOn ?? []).filter((eventName) => eventName !== 'close');
	for (const eventName of closeEvents) {
		const existing = listeners[eventName];
		listeners[eventName] = (event) => {
			existing?.(event);
			if (get(popupStore) === state) {
				closePopup();
			}
		};
	}

	// Always allow popup content to emit `close` to trigger wrapper cleanup.
	listeners.close = (event) => handlePopupClose(event, state);

	return listeners;
}

function handlePopupClose(event: CustomEvent<any>, target?: PopupState | null) {
	const snapshot = target ?? get(popupStore);
	if (snapshot?.listeners?.close) {
		snapshot.listeners.close(event);
	}
	if (get(popupStore) === snapshot) {
		closePopup();
	}
}

$: popup = $popupStore;
$: popupListeners = buildListeners(popup);
$: popupProps = popup?.props ? { ...popup.props } : {};
</script>

<ParaglideJS {i18n}>
	{#if currentRoute === '/login'}
		<slot />
	{:else}
		<main class="relative flex h-dvh w-full flex-row overflow-hidden bg-background-gradient">
			<!-- ✅ DESKTOP -->

			<div class="hidden w-full gap-4 md:flex">
				<aside class="w-80 pl-4">
					<Dashboard />
				</aside>
				<section class="flex flex-1 flex-col overflow-hidden p-4">
					<div class="flex flex-1 flex-col overflow-hidden rounded-lg bg-white">
						<slot />
					</div>
				</section>
			</div>

			<!-- ✅ MOBILE -->
			<div class="relative flex w-full items-start justify-center md:hidden">
				<div class="z-0 h-full">
					<Dashboard />
				</div>
				<!-- Sliding drawer for slot content -->
				<div class="mobile-drawer z-10" class:visible={showDrawer}>
					<!-- Back button -->
					{#if showDrawer}
						<div class="absolute right-4 top-4 z-20">
							<Button
								icon="Close"
								variant="secondary"
								on:click={closeDrawer}
								class="absolute right-4 top-4 z-20"
							/>
						</div>
					{/if}

					<div class="flex h-full flex-col overflow-hidden rounded-t-xl bg-white">
						<slot />
					</div>
				</div>
			</div>
		</main>

		<LoadingOverlay />
		<ToastContainer />
{/if}
</ParaglideJS>

{#if popup}
	<PopupWrapper
		header={popup.header ?? 'Popup'}
		icon={popup.icon}
		noClose={popup.noClose}
		dismissable={popup.dismissable ?? true}
		width={popup.width}
		height={popup.height}
		maxWidth={popup.maxWidth}
		maxHeight={popup.maxHeight}
		on:close={(event) => handlePopupClose(event, popup)}
	>
		<PopupContentHost
			component={popup.component}
			props={popupProps}
			listeners={popupListeners}
		/>
	</PopupWrapper>
{/if}

<style>
	@media (max-width: 768px) {
		.mobile-drawer {
			transition: transform 0.4s ease;
			transform: translateY(100%);
			position: absolute;
			inset: 0;
			z-index: 20;
			background: white;
			border-top-left-radius: 1rem;
			border-top-right-radius: 1rem;
		}

		.mobile-drawer.visible {
			transform: translateY(0%);
		}
	}
</style>
