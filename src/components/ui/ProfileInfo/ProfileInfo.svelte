<script lang="ts">
	import { onMount } from 'svelte';
	import { locations, fetchLocations } from '$lib/stores/locationsStore'; // Ensure fetch function exists
	import Button from '../../bits/button/Button.svelte';
	import BookingGrid from '../bookingGrid/BookingGrid.svelte';
	import ProfileEdit from '../ProfileEdit/ProfileEdit.svelte';
	import AchievementsComponent from '../achievementsComponent/AchievementsComponent.svelte';

	export let trainer;

	let isEditing = false;
	let defaultLocation = null;
	let locationsLoaded = false; // Track when locations are fetched

	onMount(async () => {
		if ($locations.length === 0) {
			await fetchLocations(); // Ensure locations are loaded
		}
		locationsLoaded = true; // Mark as loaded
	});

	// ✅ Only run when `$locations` is available
	$: if (trainer.default_location_id && locationsLoaded && $locations.length > 0) {
		defaultLocation = $locations.find((l) => l.id === trainer.default_location_id) || null;
	}
</script>

<div class="flex flex-col gap-4">
	<div class="rounded-lg bg-white p-6 shadow-md">
		<div class="mb-4 flex items-center justify-between">
			<h4 class="text-xl font-semibold">{!isEditing ? 'Profil' : 'Redigera'}</h4>
			<Button
				text={isEditing ? 'Avbryt' : 'Redigera'}
				on:click={() => (isEditing = !isEditing)}
				variant="primary"
			/>
		</div>

		{#if !isEditing}
			<p class="text-gray-600"><strong>Förnamn:</strong> {trainer.firstname}</p>
			<p class="text-gray-600"><strong>Efternamn:</strong> {trainer.lastname}</p>
			<p class="text-gray-600"><strong>Initialer:</strong> {trainer.initials}</p>
			<p class="text-gray-600"><strong>Email:</strong> {trainer.email}</p>
			<p class="text-gray-600"><strong>Mobiltelefon:</strong> {trainer.mobile}</p>
			<p class="text-gray-600">
				<strong>Primär Lokal:</strong>
				{#if trainer.default_location_id}
					{#if locationsLoaded && defaultLocation}
						{defaultLocation.name}
					{:else if !locationsLoaded}
						"Laddar..."
					{:else}
						"Ingen vald"
					{/if}
				{:else}
					"Ingen vald"
				{/if}
			</p>
			<p class="text-gray-600"><strong>Aktiv:</strong> {trainer.active ? 'Ja' : 'Nej'}</p>
		{:else}
			<ProfileEdit {trainer} onSave={() => (isEditing = false)} />
		{/if}
	</div>

	<BookingGrid trainerId={trainer.id} />
	<AchievementsComponent userId={trainer.id} />
</div>
