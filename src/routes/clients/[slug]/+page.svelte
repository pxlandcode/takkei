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

	let clientId: number;
	let client = null;
	let isLoading = true;
	let selectedTabProps: Record<string, unknown> | null = null;
	let canRenderSelectedTab = false;
	let isAwaitingTabData = false;

	$: clientId = Number($page.params.slug);

	onMount(async () => {
		if (!clientId) {
			isLoading = false;
			return;
		}

		isLoading = true;
		try {
			await clientProfileStore.loadClient(clientId, fetch);
		} catch (error) {
			console.error('Failed to load client profile:', error);
		} finally {
			isLoading = false;
		}
	});

	$: {
		const storeData = $clientProfileStore.clients[clientId];
		if (storeData) {
			client = storeData;
			isLoading = false;
		}
	}

	const menuItems = [
		{
			label: 'Profil',
			icon: 'Person',
			component: ProfileClientInfo,
			props: () => (client?.client ? { client: client.client } : {})
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
			props: () => (clientId ? { targetId: clientId, isClient: true } : {})
		}
	];
	const defaultTab = menuItems.find((item) => item.label === 'Profil') ?? menuItems[0];
	let selectedTab = defaultTab;

	$: if (!selectedTab && defaultTab) {
		selectedTab = defaultTab;
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
		const filters: Partial<CalendarFilters> = { clientIds: [clientId] };
		calendarStore.setNewFilters(filters, fetch);
		goto(getCalendarUrl(filters));
	}

	function openMailPopup() {
		const target = client?.client;
		if (!target?.email) return;
		openPopup({
			header: `Maila ${target.firstname ?? ''} ${target.lastname ?? ''}`.trim(),
			icon: 'Mail',
			component: MailComponent,
			width: '900px',
			props: {
				prefilledRecipients: [target.email],
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			}
		});
	}

	function openBookingPopup() {
		if (!clientId) return;
		openPopup({
			header: 'Bokning',
			icon: 'Plus',
			component: BookingPopup,
			props: { clientId },
			maxWidth: '650px'
		});
	}
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
		<Button icon="Mail" variant="secondary" on:click={openMailPopup} />
		<Button icon="Calendar" variant="secondary" on:click={goToCalendar} />
		<Button
			iconLeft="Plus"
			iconLeftSize="12px"
			text="Boka"
			variant="primary"
			icon="Plus"
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

<style>
	.tab-button {
		@apply flex items-center gap-2 rounded-sm p-2 text-gray-600 hover:bg-gray-200;
	}
	.selected {
		@apply bg-gray-200 font-semibold;
	}
</style>
