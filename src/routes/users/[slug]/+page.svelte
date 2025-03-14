<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Icon from '../../../components/bits/icon-component/Icon.svelte';
	import Button from '../../../components/bits/button/Button.svelte';
	import ProfileInfo from '../../../components/ui/ProfileInfo/ProfileInfo.svelte';
	import { profileStore } from '$lib/stores/profileStore';
	import ProfileBookingComponent from '../../../components/ui/profileBookingComponent/ProfileBookingComponent.svelte';
	import ProfileNotesComponent from '../../../components/ui/profileNotesComponent/ProfileNotesComponent.svelte';

	let trainerId;
	let profile = null;
	let trainer = null;
	let selectedTab = 'Profil';

	// ✅ Ensure trainerId is properly retrieved from URL
	$: trainerId = Number($page.params.slug);

	// ✅ Fetch the user when the component mounts
	onMount(async () => {
		if (trainerId) {
			await profileStore.loadUser(trainerId, fetch);
		}
	});

	// ✅ Watch for changes in profileStore reactively
	$: {
		if ($profileStore.users[trainerId]) {
			profile = $profileStore.users[trainerId];
			trainer = profile.user;
		}
	}
</script>

<div class="custom-scrollbar">
	<!-- Page Title -->
	<div class="m-4 ml-3 flex items-center justify-between">
		<div class="flex flex-row items-center gap-2">
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
				<Icon icon="Person" size="18px" />
			</div>
			<h2 class="text-3xl font-semibold text-text">
				{trainer ? `${trainer.firstname} ${trainer.lastname}` : 'Laddar tränare...'}
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
			on:click={() => (selectedTab = 'Klienter')}
			class="tab-button {selectedTab === 'Klienter' && 'selected'}"
		>
			<Icon icon="Clients" size="18px" /> Klienter
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
						'Klienter' && 'selected'}"
					on:click={() => (selectedTab = 'Klienter')}
				>
					<Icon icon="Clients" size="18px" /> Klienter
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
				{#if trainer}
					<ProfileInfo {trainer} />
				{:else}
					<p class="text-gray-500">Laddar profil...</p>
				{/if}
			{:else if selectedTab === 'Bokningar'}
				<!-- ✅ Make this wrapper fill the available space and be scrollable -->
				<div class="h-full max-h-[80vh] overflow-y-auto">
					<ProfileBookingComponent {trainerId} />
				</div>
			{:else if selectedTab === 'Klienter'}
				<p class="text-gray-500">Klienter kommer att listas här.</p>
			{:else if selectedTab === 'Anteckningar'}
				<div class="flex h-[80vh] flex-col">
					<ProfileNotesComponent {trainerId} />
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
