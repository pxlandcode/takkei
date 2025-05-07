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
	import PopupWrapper from '../../../components/ui/popupWrapper/PopupWrapper.svelte';
	import MailComponent from '../../../components/ui/mailComponent/MailComponent.svelte';

	let clientId: number;
	let client = null;
	let showMailPopup = false;

	$: clientId = Number($page.params.slug);

	onMount(async () => {
		if (clientId) {
			await clientProfileStore.loadClient(clientId, fetch);
		}
	});

	$: {
		const storeData = $clientProfileStore.clients[clientId];
		if (storeData) {
			client = storeData;
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
			props: () => (clientId ? { clientId } : {})
		},
		{
			label: 'Anteckningar',
			icon: 'Notes',
			component: ProfileNotesComponent,
			props: () => (clientId ? { targetId: clientId, isClient: true } : {})
		}
	];

	let selectedTab = menuItems[0];
</script>

<!-- Header -->
<div class="m-4 flex items-center justify-between">
	<div class="flex items-center gap-2">
		<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Person" size="18px" />
		</div>
		<h2 class="text-3xl font-semibold text-text">
			{client ? `${client.client.firstname} ${client.client.lastname}` : 'Laddar klient...'}
		</h2>
	</div>

	<div class="flex space-x-2">
		<Button icon="Mail" variant="secondary" on:click={() => (showMailPopup = true)} />
		<Button icon="Calendar" variant="secondary" />
		<Button iconLeft="Plus" iconLeftSize="12px" text="Boka" variant="primary" icon="Plus" />
	</div>
</div>

<!-- Shared Navigation and Component Rendering -->
<Navigation {menuItems} bind:selectedTab>
	{#if selectedTab.component && (!selectedTab.props || Object.keys(selectedTab.props()).length > 0)}
		<svelte:component this={selectedTab.component} {...selectedTab.props()} />
	{:else}
		<p class="text-gray-500">Innehåll kommer snart.</p>
	{/if}
</Navigation>

{#if showMailPopup && client?.client?.email}
	<PopupWrapper
		width="900px"
		header="Maila {client.client.firstname} {client.client.lastname}"
		icon="Mail"
		on:close={() => (showMailPopup = false)}
	>
		<MailComponent
			prefilledRecipients={[client.client.email]}
			lockedFields={['recipients']}
			autoFetchUsersAndClients={false}
		/>
	</PopupWrapper>
{/if}

<style>
	.tab-button {
		@apply flex items-center gap-2 rounded-md p-2 text-gray-600 hover:bg-gray-200;
	}
	.selected {
		@apply bg-gray-200 font-semibold;
	}
</style>
