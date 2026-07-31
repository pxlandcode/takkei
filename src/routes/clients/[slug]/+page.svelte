<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Icon from '../../../components/bits/icon-component/Icon.svelte';
	import Button from '../../../components/bits/button/Button.svelte';
	import Navigation from '../../../components/bits/navigation/Navigation.svelte';
	import { clientProfileStore } from '$lib/stores/clientProfileStore';
	import ProfileClientInfo from '../../../components/ui/ProfileClientInfo/ProfileClientInfo.svelte';
	import ProfileBookingComponent from '../../../components/ui/profileBookingComponent/ProfileBookingComponent.svelte';
	import ProfileNotesComponent from '../../../components/ui/profileNotesComponent/ProfileNotesComponent.svelte';
	import MailComponent from '../../../components/ui/mailComponent/MailComponent.svelte';
	import { goto } from '$app/navigation';
	import { calendarStore } from '$lib/stores/calendarStore';
	import type { CalendarFilters } from '$lib/stores/calendarStore';
	import { getCalendarUrl } from '$lib/helpers/calendarHelpers/calendarNavigation';
	import BookingPopup from '../../../components/ui/bookingPopup/BookingPopup.svelte';
	import { openPopup } from '$lib/stores/popupStore';
	import ProfileLifecycleManager from '../../../components/ui/ProfileLifecycleManager.svelte';
	import type { Client } from '$lib/types/clientTypes';

	let clientId: number;
	let client: { client: Client; bookingsShort?: unknown[] } | null = null;
	let isLoading = true;
	let selectedTabProps: any = null;
	let canRenderSelectedTab = false;
	let isAwaitingTabData = false;
	let hasMounted = false;
	let requestedClientId: number | null = null;

	$: clientId = Number($page.params.slug);
	$: currentClient = client?.client ?? null;
	$: isDeleted = Boolean(currentClient?.gdpr_deleted_at);

	async function loadClientProfile(id: number) {
		if (!Number.isFinite(id) || id <= 0) {
			requestedClientId = null;
			client = null;
			isLoading = false;
			return;
		}

		requestedClientId = id;
		isLoading = true;
		client = null;
		try {
			await clientProfileStore.loadClient(id, fetch, { fresh: true });
		} catch (error) {
			console.error('Failed to load client profile:', error);
		} finally {
			if (requestedClientId === id) {
				isLoading = false;
			}
		}
	}

	onMount(() => {
		hasMounted = true;
		void loadClientProfile(clientId);
	});

	$: {
		const storeData = $clientProfileStore.clients[clientId];
		if (storeData && requestedClientId === clientId) {
			client = storeData;
			isLoading = false;
		} else if (isLoading) {
			client = null;
		}
	}

	const menuItems = [
		{
			label: 'Profil',
			icon: 'Person',
			component: ProfileClientInfo,
			props: () =>
				client?.client
					? {
							client: client.client,
							allowEditing: !isDeleted,
							allowMailPopup: !isDeleted,
							allowPackageManagement: !isDeleted
						}
					: {}
		},
		{
			label: 'Bokningar',
			icon: 'Calendar',
			component: ProfileBookingComponent,
			props: () => (clientId && client?.client ? { clientId, client: client.client } : {})
		},
		{
			label: 'Anteckningar',
			icon: 'Notes',
			component: ProfileNotesComponent,
			props: () =>
				clientId
					? { targetId: clientId, isClient: true, targetType: 'Client', readOnly: isDeleted }
					: {}
		},
		{
			label: 'Hantering',
			icon: 'Trash',
			component: ProfileLifecycleManager,
			requiredRoles: ['Administrator'],
			props: () =>
				clientId && currentClient
					? {
							entity: 'client',
							entityId: clientId,
							displayName:
								`${currentClient.firstname ?? ''} ${currentClient.lastname ?? ''}`.trim(),
							isDeleted,
							onDeleted: handleLifecycleDeleted,
							onMerged: handleLifecycleMerged
						}
					: {}
		}
	];
	const defaultTab = menuItems.find((item) => item.label === 'Profil') ?? menuItems[0];
	let selectedTab = defaultTab;

	$: if (!selectedTab && defaultTab) {
		selectedTab = defaultTab;
	}

	$: if (
		hasMounted &&
		Number.isFinite(clientId) &&
		clientId > 0 &&
		clientId !== requestedClientId
	) {
		selectedTab = defaultTab;
		void loadClientProfile(clientId);
	}

	$: {
		// ensure reactivity when client data changes
		client;
		clientId;
		const props = selectedTab?.props ? selectedTab.props() : null;
		selectedTabProps = props;
		isAwaitingTabData =
			Boolean(selectedTab?.component) &&
			Boolean(selectedTab?.props) &&
			(!props || Object.keys(props).length === 0);
		canRenderSelectedTab = Boolean(selectedTab?.component) && !isAwaitingTabData;
	}

	function goToCalendar() {
		if (isDeleted) return;
		const filters: Partial<CalendarFilters> = { clientIds: [clientId] };
		calendarStore.setNewFilters(filters, fetch);
		goto(getCalendarUrl(filters));
	}

	function openMailPopup() {
		const target = client?.client;
		if (!target?.email || isDeleted) return;
		openPopup({
			header: `Maila ${target.firstname ?? ''} ${target.lastname ?? ''}`.trim(),
			icon: 'Mail',
			component: MailComponent,
			maxWidth: '900px',
			props: {
				prefilledRecipients: [target.email],
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			}
		});
	}

	function openBookingPopup() {
		if (!clientId || isDeleted) return;
		openPopup({
			header: 'Bokning',
			icon: 'Plus',
			component: BookingPopup,
			props: { clientId },
			maxWidth: '650px'
		});
	}

	async function reloadClientProfile() {
		await loadClientProfile(clientId);
	}

	function handleLifecycleDeleted(event: CustomEvent<any>) {
		const result = event.detail;
		if (!result?.hardDeleted) void reloadClientProfile();
	}

	function handleLifecycleMerged(_event: CustomEvent<any>) {}
</script>

<!-- Header -->
<div class="m-4 flex flex-wrap items-center justify-between gap-2">
	<div class="flex items-center gap-2">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Person" size="18px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">
			{client ? `${client.client.firstname} ${client.client.lastname}` : 'Laddar klient...'}
		</h2>
	</div>

	<div class="mr-14 flex space-x-2 md:mr-0">
		<Button
			icon="Mail"
			variant="secondary"
			disabled={isDeleted || !currentClient?.email}
			on:click={openMailPopup}
		/>
		<Button icon="Calendar" variant="secondary" disabled={isDeleted} on:click={goToCalendar} />
		<Button
			iconLeft="Plus"
			iconLeftSize="12px"
			text="Boka"
			variant="primary"
			icon="Plus"
			disabled={isDeleted}
			on:click={openBookingPopup}
		/>
	</div>
</div>

<!-- Shared Navigation and Component Rendering -->
<Navigation {menuItems} bind:selectedTab>
	{#if isLoading || isAwaitingTabData}
		<p class="text-gray-500">Laddar innehåll...</p>
	{:else if canRenderSelectedTab}
		<svelte:component this={selectedTab.component} {...selectedTabProps ?? {}} />
	{:else}
		<p class="text-gray-500">Innehåll kommer snart.</p>
	{/if}
</Navigation>
