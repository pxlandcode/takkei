<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Icon from '../../../components/bits/icon-component/Icon.svelte';
	import Button from '../../../components/bits/button/Button.svelte';
	import ProfileInfo from '../../../components/ui/ProfileInfo/ProfileInfo.svelte';
	import { profileStore } from '$lib/stores/profileStore';

	let trainerId;
	let profile = null;
	let trainer = null;

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

	// Tabs State
	let selectedTab = 'Profil';
</script>

<div class="h-full overflow-x-scroll custom-scrollbar">
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

	<div class="flex h-screen border-t">
		<aside class="w-64 border-r p-6">
			<!-- Navigation Tabs -->
			<ul class="space-y-2 text-gray-600">
				<li
					class="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-200"
					on:click={() => (selectedTab = 'Profil')}
				>
					<Icon icon="Person" size="18px" /> Profil
				</li>
				<li
					class="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-200"
					on:click={() => (selectedTab = 'Bokningar')}
				>
					<Icon icon="Calendar" size="18px" /> Bokningar
				</li>
				<li
					class="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-200"
					on:click={() => (selectedTab = 'Klienter')}
				>
					<Icon icon="Clients" size="18px" /> Klienter
				</li>
				<li
					class="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-200"
					on:click={() => (selectedTab = 'Anteckningar')}
				>
					<Icon icon="Notes" size="18px" /> Anteckningar
				</li>
			</ul>
		</aside>

		<div class="flex-1 p-6">
			{#if selectedTab === 'Profil'}
				{#if trainer}
					<ProfileInfo {trainer} />
				{:else}
					<p class="text-gray-500">Laddar profil...</p>
				{/if}
			{:else if selectedTab === 'Bokningar'}
				<p class="text-gray-500">Bokningar kommer att listas här.</p>
			{:else if selectedTab === 'Klienter'}
				<p class="text-gray-500">Klienter kommer att listas här.</p>
			{:else if selectedTab === 'Anteckningar'}
				<p class="text-gray-500">Anteckningar kommer att listas här.</p>
			{/if}
		</div>
	</div>
</div>

<style>
	.selected {
		@apply bg-gray-200 font-semibold;
	}
</style>
