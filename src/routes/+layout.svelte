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

	import { onMount, onDestroy } from 'svelte';
	import type { ComponentType } from 'svelte';
	import { browser, dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import Button from '../components/bits/button/Button.svelte';
	import PopupWrapper from '../components/ui/popupWrapper/PopupWrapper.svelte';
	import PopupContentHost from '../components/ui/popupWrapper/PopupContentHost.svelte';
	import Icon from '../components/bits/icon-component/Icon.svelte';
	import MinimizedPopupsButton from '../components/ui/minimizedPopupsButton/MinimizedPopupsButton.svelte';

	import {
		popupStore,
		openPopup,
		closePopup,
		minimizePopup,
		type PopupState
	} from '$lib/stores/popupStore';
	import { get } from 'svelte/store';
	import { loadingStore } from '$lib/stores/loading';
	import { headerState } from '$lib/stores/headerState.svelte';
	import AbsenceReturnPopup from '../components/ui/absenceReturnPopup/AbsenceReturnPopup.svelte';
	import { fetchAvailability } from '$lib/services/api/availabilityService';
	import {
		acknowledgeAbsencePrompt,
		absencePromptAcknowledgedKey,
		buildCurrentAbsenceKey,
		clearAcknowledgedAbsencePrompt,
		resolveCurrentAbsence,
		type CurrentAbsence
	} from '$lib/helpers/availability/currentAbsence';

	export let data;
	$user = data.user;

	$: currentAccount = $user;
	$: isTrainer = currentAccount?.kind === 'trainer';
	$: isClient = currentAccount?.kind === 'client';

	let isMobile = false;
	let showDrawer = false;
	let resizeHandler: (() => void) | null = null;
	let clientRootDrawerClosed = false;
	const MOBILE_BREAKPOINT = 768;

	let showTopLoadingBar = false;
	let loadingBarVisible = false;
	let loadingBarPhase: 'loading' | 'complete' = 'loading';
	let loadingBarSequence = 0;
	let loadingBarHideTimeout: ReturnType<typeof setTimeout> | null = null;
	const LOADING_BAR_HIDE_DELAY = 300;

	let popup: PopupState | null = null;
	let popupListeners: Record<string, (event: CustomEvent<any>) => void> = {};
	let popupProps: Record<string, unknown> = {};
	let currentAbsencePrompt: CurrentAbsence | null = null;
	let absencePromptLoadedForUserId: number | null = null;
	let absencePromptLoadToken = 0;

	$: currentRoute = $page.url.pathname;

	$: navigating.to && loadingStore.loading(!!navigating.to);

	$: isRouteNavigating = Boolean(navigating?.to);
	$: isGlobalLoading = Boolean($loadingStore?.isLoading);
	$: showTopLoadingBar = isRouteNavigating || isGlobalLoading;
	$: {
		if (showTopLoadingBar) {
			activateTopLoadingBar();
		} else {
			completeTopLoadingBar();
		}
	}

	function activateTopLoadingBar() {
		if (!loadingBarVisible) {
			loadingBarVisible = true;
			loadingBarSequence += 1;
		} else if (loadingBarPhase === 'complete') {
			loadingBarSequence += 1;
		}
		loadingBarPhase = 'loading';
		if (loadingBarHideTimeout) {
			clearTimeout(loadingBarHideTimeout);
			loadingBarHideTimeout = null;
		}
	}

	function completeTopLoadingBar() {
		if (!loadingBarVisible || loadingBarPhase === 'complete') return;
		loadingBarPhase = 'complete';
		if (loadingBarHideTimeout) {
			clearTimeout(loadingBarHideTimeout);
		}
		loadingBarHideTimeout = setTimeout(() => {
			loadingBarVisible = false;
			loadingBarHideTimeout = null;
		}, LOADING_BAR_HIDE_DELAY);
	}

	onDestroy(() => {
		if (loadingBarHideTimeout) {
			clearTimeout(loadingBarHideTimeout);
		}
		if (browser && resizeHandler) {
			window.removeEventListener('resize', resizeHandler);
		}
	});

	$: if (!isTrainer && !isClient) {
		showDrawer = false;
		clientRootDrawerClosed = false;
	}

	function updateIsMobile() {
		if (!browser) return;
		isMobile = window.innerWidth < MOBILE_BREAKPOINT;
	}

	function syncDrawerForRoute(
		pathname = currentRoute,
		accountKind: string | null | undefined = currentAccount?.kind
	) {
		if (accountKind !== 'trainer' && accountKind !== 'client') {
			showDrawer = false;
			return;
		}

		if (!isMobile) {
			showDrawer = false;
			return;
		}

		const defaultRoute = accountKind === 'trainer' ? '/' : '/client';
		if (accountKind === 'trainer') {
			showDrawer = pathname !== defaultRoute;
			return;
		}

		if (pathname === defaultRoute) {
			showDrawer = !clientRootDrawerClosed;
			return;
		}

		clientRootDrawerClosed = false;
		showDrawer = true;
	}

	// Detect mobile and route changes
	onMount(() => {
		if (!browser) {
			return;
		}

		const current = get(user);
		const allowDrawer = current?.kind === 'trainer' || current?.kind === 'client';
		if (!allowDrawer) {
			return;
		}

		if (current?.kind === 'trainer' && 'serviceWorker' in navigator && !dev) {
			navigator.serviceWorker
				.register('/service-worker.js')
				.catch((error) => console.error('Service worker registration failed', error));
		}

		updateIsMobile();
		syncDrawerForRoute(currentRoute, current?.kind);

		resizeHandler = () => {
			updateIsMobile();
			syncDrawerForRoute(currentRoute, currentAccount?.kind);
		};
		window.addEventListener('resize', resizeHandler);
	});

	$: if (browser) {
		syncDrawerForRoute(currentRoute, currentAccount?.kind);
	}

	function closeDrawer() {
		if (isClient) {
			clientRootDrawerClosed = true;
		}
		showDrawer = false;
		goto(isTrainer ? '/' : '/client');
	}

	async function loadCurrentAbsencePrompt(userId: number) {
		const token = ++absencePromptLoadToken;

		try {
			const availability = await fetchAvailability(userId, { cache: false });
			if (token !== absencePromptLoadToken) return;

			const absences = Array.isArray(availability?.absences)
				? (availability.absences as CurrentAbsence[])
				: [];
			currentAbsencePrompt = resolveCurrentAbsence(absences);

			if (!currentAbsencePrompt) {
				clearAcknowledgedAbsencePrompt();
			}
		} catch (error) {
			if (token !== absencePromptLoadToken) return;
			console.error('Failed to load absence prompt state', error);
		}
	}

	function openAbsenceReturnPopup(userId: number, absence: CurrentAbsence) {
		openPopup({
			id: 'absence-return',
			header: 'Frånvaro',
			icon: 'CircleAlert',
			component: AbsenceReturnPopup as unknown as ComponentType,
			dismissable: false,
			noClose: true,
			draggable: false,
			minimizable: false,
			maxWidth: '560px',
			props: {
				userId,
				absence
			},
			listeners: {
				resolved: (event) => {
					const action = event.detail?.action as 'continued' | 'returned' | undefined;
					if (action === 'continued') {
						acknowledgeAbsencePrompt(buildCurrentAbsenceKey(userId, absence));
						return;
					}

					if (action === 'returned') {
						currentAbsencePrompt = null;
						clearAcknowledgedAbsencePrompt();
					}
				}
			},
			closeOn: ['resolved']
		});
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

	function handlePopupMinimize(event: CustomEvent<any>, target?: PopupState | null) {
		const snapshot = target ?? get(popupStore);
		if (!snapshot) return;

		// Update position if provided
		const position = event.detail?.position;
		if (position) {
			snapshot.position = position;
		}

		minimizePopup(snapshot);
	}

	$: popup = $popupStore;
	$: popupListeners = buildListeners(popup);
	$: popupProps = popup?.props ? { ...popup.props } : {};
	$: if (
		!currentAccount &&
		(currentAbsencePrompt || absencePromptLoadedForUserId !== null || $absencePromptAcknowledgedKey)
	) {
		currentAbsencePrompt = null;
		absencePromptLoadedForUserId = null;
		absencePromptLoadToken += 1;
		clearAcknowledgedAbsencePrompt();
	}
	$: if (
		browser &&
		currentRoute === '/login' &&
		(currentAbsencePrompt || absencePromptLoadedForUserId !== null || $absencePromptAcknowledgedKey)
	) {
		currentAbsencePrompt = null;
		absencePromptLoadedForUserId = null;
		absencePromptLoadToken += 1;
		clearAcknowledgedAbsencePrompt();
	}
	$: if (
		browser &&
		currentRoute !== '/login' &&
		currentAccount?.kind === 'trainer' &&
		currentAccount.id !== absencePromptLoadedForUserId
	) {
		absencePromptLoadedForUserId = currentAccount.id;
		loadCurrentAbsencePrompt(currentAccount.id);
	}
	$: currentAbsencePromptKey =
		currentRoute !== '/login' && currentAccount?.kind === 'trainer' && currentAbsencePrompt
			? buildCurrentAbsenceKey(currentAccount.id, currentAbsencePrompt)
			: null;
	$: shouldShowAbsencePrompt = Boolean(
		currentRoute !== '/login' &&
			currentAccount?.kind === 'trainer' &&
			currentAbsencePrompt &&
			currentAbsencePromptKey &&
			$absencePromptAcknowledgedKey !== currentAbsencePromptKey
	);
	$: if (shouldShowAbsencePrompt && currentAccount?.kind === 'trainer' && currentAbsencePrompt) {
		if (popup?.id !== 'absence-return') {
			openAbsenceReturnPopup(currentAccount.id, currentAbsencePrompt);
		}
	}
	$: if (!shouldShowAbsencePrompt && popup?.id === 'absence-return') {
		closePopup();
	}
</script>

<ParaglideJS {i18n}>
	<div class="top-loading-bar" aria-hidden="true">
		{#if loadingBarVisible}
			{#key loadingBarSequence}
				<div
					class="top-loading-bar__fill bg-primary"
					class:complete={loadingBarPhase === 'complete'}
				></div>
			{/key}
		{/if}
	</div>
	{#if currentRoute === '/login'}
		<slot />
	{:else if isClient}
		<main class="bg-background-gradient relative flex h-dvh w-full overflow-hidden">
			<div class="hidden w-full gap-4 md:flex">
				<aside class="w-80 pl-4">
					<Dashboard clientMode />
				</aside>
				<section class="flex flex-1 flex-col overflow-hidden p-4">
					<div class="flex flex-1 flex-col overflow-hidden rounded-sm bg-white">
						<div class="flex-1 overflow-y-auto">
							<slot />
						</div>
					</div>
				</section>
			</div>
			<div class="relative flex w-full items-start justify-center md:hidden">
				<div class="z-0 h-full">
					<Dashboard clientMode />
				</div>
				<div class="mobile-drawer z-10" class:visible={showDrawer}>
					<div class="flex h-full flex-col overflow-hidden rounded-t-xl bg-white">
						{#if showDrawer}
							<div
								class="border-gray/10 flex w-full items-center justify-between border-b p-2 pl-4"
							>
								<div class="flex items-center gap-2">
									{#if headerState.icon}
										<div
											class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white"
										>
											<Icon icon={headerState.icon} size="14px" />
										</div>
									{/if}
									<h2 class="text-lg font-semibold text-gray-800">{headerState.title}</h2>
								</div>
								<Button icon="Close" variant="secondary" on:click={closeDrawer} small />
							</div>
						{/if}
						<div class="flex-1 overflow-y-auto p-4">
							<slot />
						</div>
					</div>
				</div>
			</div>
		</main>
		<LoadingOverlay />
		<ToastContainer />
	{:else}
		<main class="bg-background-gradient relative flex h-dvh w-full flex-row overflow-hidden">
			<!-- ✅ DESKTOP -->

			<div class="hidden w-full gap-4 md:flex">
				<aside class="w-80 pl-4">
					<Dashboard />
				</aside>
				<section class="flex flex-1 flex-col overflow-hidden p-4">
					<div class="flex flex-1 flex-col overflow-hidden rounded-sm bg-white">
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
					<div class="flex h-full flex-col overflow-hidden rounded-t-xl bg-white">
						{#if showDrawer}
							<div
								class="border-gray/10 flex w-full items-center justify-between border-b p-2 pl-4"
							>
								<div class="flex items-center gap-2">
									{#if headerState.icon}
										<div
											class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white"
										>
											<Icon icon={headerState.icon} size="14px" />
										</div>
									{/if}
									<h2 class="text-lg font-semibold text-gray-800">{headerState.title}</h2>
								</div>
								<Button icon="Close" variant="secondary" on:click={closeDrawer} small />
							</div>
						{/if}
						<div class="flex-1 overflow-y-auto p-4">
							<slot />
						</div>
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
		variant={popup.variant ?? 'modal'}
		width={popup.width}
		height={popup.height}
		maxWidth={popup.maxWidth}
		maxHeight={popup.maxHeight}
		draggable={popup.draggable ?? true}
		minimizable={popup.minimizable ?? true}
		initialPosition={popup.position}
		on:close={(event) => handlePopupClose(event, popup)}
		on:minimize={(event) => handlePopupMinimize(event, popup)}
	>
		<PopupContentHost component={popup.component} props={popupProps} listeners={popupListeners} />
	</PopupWrapper>
{/if}

<MinimizedPopupsButton />

<style>
	.top-loading-bar {
		position: fixed;
		top: env(safe-area-inset-top, 0px);
		left: 0;
		width: 100%;
		height: 4px;
		z-index: 1000;
		pointer-events: none;
	}

	.top-loading-bar__fill {
		width: 100%;
		height: 100%;

		transform: scaleX(0);
		transform-origin: left center;
		animation: top-loading-bar-progress 1.5s ease-in-out infinite;
		transition:
			transform 0.25s ease-out,
			opacity 0.25s ease-out;
	}

	.top-loading-bar__fill.complete {
		animation: none;
		transform: scaleX(1);
		opacity: 1;
	}

	@keyframes top-loading-bar-progress {
		0% {
			transform: scaleX(0);
			opacity: 0.5;
		}
		60% {
			transform: scaleX(0.85);
			opacity: 1;
		}
		100% {
			transform: scaleX(1);
			opacity: 0.7;
		}
	}

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
			pointer-events: none;
		}

		.mobile-drawer * {
			pointer-events: none;
		}

		.mobile-drawer.visible {
			transform: translateY(0%);
			pointer-events: auto;
		}

		.mobile-drawer.visible * {
			pointer-events: auto;
		}

		.client-shell {
			padding: 2rem 1rem;
		}
	}
</style>
