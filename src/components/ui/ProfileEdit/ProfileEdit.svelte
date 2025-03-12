<script lang="ts">
	import { onMount } from 'svelte';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import Button from '../../bits/button/Button.svelte';

	export let trainer;
	export let onSave;

	// Fetch locations on mount
	onMount(fetchLocations);
</script>

<div class="rounded-lg bg-white p-6">
	<!-- Input Fields -->
	<Input label="Förnamn" bind:value={trainer.firstname} />
	<Input label="Efternamn" bind:value={trainer.lastname} />
	<Input label="Initialer" bind:value={trainer.initials} />
	<Input label="E-post" bind:value={trainer.email} />
	<Input label="Mobiltelefon" bind:value={trainer.mobile} />

	<!-- Dropdown for Primary Location -->
	<Dropdown
		id="location"
		label="Primär Lokal"
		placeholder="Välj plats"
		options={$locations.map((loc) => ({ label: loc.name, value: loc.id }))}
		bind:selectedValue={trainer.default_location_id}
	/>

	<label class="mt-4 flex items-center gap-2 text-sm font-medium text-gray">
		<input type="checkbox" bind:checked={trainer.active} class="h-4 w-4" />
		Aktiv
	</label>
</div>
