<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { loadingStore } from '$lib/stores/loading';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	export let trainer;
	export let onSave;

	const dispatch = createEventDispatcher();
	let errors: Record<string, string> = {};

	onMount(fetchLocations);

	async function handleSave() {
		errors = {};
		try {
			loadingStore.loading(true, 'Sparar ändringar...');

			let res = await fetch(`/api/users/${trainer.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...trainer })
			});

			const result = await res.json();

			if (!res.ok) {
				errors = result.errors || { general: 'Kunde inte spara ändringar' };
				addToast({
					type: AppToastType.CANCEL,
					message: 'Fel',
					description: errors.general
				});
				return;
			}

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Profil uppdaterad',
				description: `${trainer.firstname} ${trainer.lastname} har uppdaterats korrekt.`
			});

			if (onSave) onSave();
		} catch (err) {
			console.error('Save error', err);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel',
				description: 'Ett fel uppstod vid uppdatering.'
			});
		} finally {
			loadingStore.loading(false);
		}
	}
</script>

<div class="flex flex-col gap-4 rounded-lg bg-white p-6">
	<!-- Input Fields -->
	<Input label="Förnamn" bind:value={trainer.firstname} name="firstname" {errors} />
	<Input label="Efternamn" bind:value={trainer.lastname} name="lastname" {errors} />
	<Input label="Initialer" bind:value={trainer.initials} name="initials" {errors} />
	<Input label="E-post" bind:value={trainer.email} name="email" {errors} />
	<Input label="Mobiltelefon" bind:value={trainer.mobile} name="mobile" {errors} />

	<!-- Dropdown for Primary Location -->
	<Dropdown
		id="default_location_id"
		label="Primär Lokal"
		placeholder="Välj plats"
		options={$locations.map((loc) => ({ label: loc.name, value: loc.id }))}
		bind:selectedValue={trainer.default_location_id}
		{errors}
	/>

	<label class="mt-2 flex items-center gap-2 text-sm font-medium text-gray">
		<input type="checkbox" bind:checked={trainer.active} class="h-4 w-4" />
		Aktiv
	</label>

	{#if errors.general}
		<p class="text-sm font-medium text-error">{errors.general}</p>
	{/if}

	<!-- Save Button -->
	<div class="pt-2">
		<Button
			text="Spara ändringar"
			iconRight="Check"
			iconRightSize="16"
			variant="primary"
			full
			on:click={handleSave}
		/>
	</div>
</div>
