<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Icon from '../../../components/bits/icon-component/Icon.svelte';
	import Button from '../../../components/bits/button/Button.svelte';
	import { clientProfileStore } from '$lib/stores/clientProfileStore';
	import BookingGrid from '../../../components/ui/bookingGrid/BookingGrid.svelte';
	import ProfileClientInfo from '../../../components/ui/ProfileClientInfo/ProfileClientInfo.svelte';
	import ProfileBookingComponent from '../../../components/ui/profileBookingComponent/ProfileBookingComponent.svelte';
	import ProfileNotesComponent from '../../../components/ui/profileNotesComponent/ProfileNotesComponent.svelte';

	let clientId;
	let client = null;
	let selectedTab = 'Profil';

	// ✅ Ensure clientId is properly retrieved from URL
	$: clientId = Number($page.params.slug);

	// ✅ Fetch the client when the component mounts
	onMount(async () => {
		if (clientId) {
			await clientProfileStore.loadClient(clientId, fetch);
		}
	});

	// ✅ Watch for changes in clientProfileStore reactively
	$: {
		const storeData = $clientProfileStore.clients[clientId];
		if (storeData) {
			client = storeData;
			console.log('client', client);
		}
	}
</script>

<div class="m-4 custom-scrollbar">
	<!-- Page Title -->
	<div class="  flex items-center justify-between">
		<div class="flex flex-row items-center gap-2">
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
				<Icon icon="Person" size="18px" />
			</div>
			<h2 class="text-3xl font-semibold text-text">
				{client ? `${client.client.firstname} ${client.client.lastname}` : 'Laddar klient...'}
			</h2>
		</div>

		<div class="flex space-x-2">
			<Button icon="Calendar" variant="secondary" />
			<Button iconLeft="Plus" iconLeftSize="12px" text="Boka" variant="primary" icon="Plus" />
		</div>
	</div>

	<!-- 🔹 Top Navigation (Visible on small screens) -->
	<nav class="flex w-full justify-around border-b p-4 2xl:hidden">
		<button
			on:click={() => (selectedTab = 'Profil')}
			class="tab-button {selectedTab === 'Profil' && 'selected'}"
		>
			<Icon icon="Person" size="18px" /> Profil
		</button>
		<button
			on:click={() => (selectedTab = 'Bokningar')}
			class="tab-button {selectedTab === 'Bokningar' && 'selected'}"
		>
			<Icon icon="Calendar" size="18px" /> Bokningar
		</button>
		<button
			on:click={() => (selectedTab = 'Anteckningar')}
			class="tab-button {selectedTab === 'Anteckningar' && 'selected'}"
		>
			<Icon icon="Notes" size="18px" /> Anteckningar
		</button>
	</nav>

	<div class="flex border-t">
		<!-- 🔹 Sidebar Navigation (Hidden on small screens) -->
		<aside class="hidden w-64 border-r p-6 2xl:block">
			<ul class="space-y-2 text-gray-600">
				<li
					class="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-200 {selectedTab ===
						'Profil' && 'selected'}"
					on:click={() => (selectedTab = 'Profil')}
				>
					<Icon icon="Person" size="18px" /> Profil
				</li>
				<li
					class="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-200 {selectedTab ===
						'Bokningar' && 'selected'}"
					on:click={() => (selectedTab = 'Bokningar')}
				>
					<Icon icon="Calendar" size="18px" /> Bokningar
				</li>
				<li
					class="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-200 {selectedTab ===
						'Anteckningar' && 'selected'}"
					on:click={() => (selectedTab = 'Anteckningar')}
				>
					<Icon icon="Notes" size="18px" /> Anteckningar
				</li>
			</ul>
		</aside>

		<!-- 🔹 Content Section -->
		<div class="flex-1 p-6">
			{#if selectedTab === 'Profil'}
				{#if client}
					<div class="h-full max-h-[80vh] overflow-y-auto">
						<ProfileClientInfo client={client.client} />
					</div>
				{:else}
					<p class="text-gray-500">Laddar profil...</p>
				{/if}
			{:else if selectedTab === 'Bokningar'}
				<div class="h-full max-h-[80vh] overflow-y-auto">
					<ProfileBookingComponent {clientId} />
				</div>
			{:else if selectedTab === 'Anteckningar'}
				<div class="flex max-h-[80vh] flex-col">
					<ProfileNotesComponent targetId={clientId} isClient />
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.tab-button {
		@apply flex items-center gap-2 rounded-md p-2 text-gray-600 hover:bg-gray-200;
	}

	.selected {
		@apply bg-gray-200 font-semibold;
	}
</style>
