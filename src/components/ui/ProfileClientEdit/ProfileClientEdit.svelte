<script lang="ts">
	import { onMount } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import Input from '../../bits/Input/Input.svelte';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { loadingStore } from '$lib/stores/loading';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	export let client;
	export let onSave: () => void;

	let errors: Record<string, string> = {};

	onMount(fetchUsers);

	async function handleSave() {
		errors = {};
		try {
			loadingStore.loading(true, 'Sparar ändringar...');

			const res = await fetch(`/api/clients/${client.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...client })
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
				message: 'Klient uppdaterad',
				description: `${client.firstname} ${client.lastname} har uppdaterats korrekt.`
			});

			if (onSave) onSave();
		} catch (err) {
			console.error('Client save error:', err);
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

<div class="flex flex-col gap-4 rounded-sm bg-white p-6">
	<Input label="Förnamn" bind:value={client.firstname} name="firstname" {errors} />
	<Input label="Efternamn" bind:value={client.lastname} name="lastname" {errors} />
	<Input label="Personnummer" bind:value={client.person_number} name="person_number" {errors} />
	<Input label="E-post" bind:value={client.email} name="email" {errors} />
	<Input
		label="Alternativ e-post"
		bind:value={client.alternative_email}
		name="alternative_email"
		{errors}
	/>
	<Input label="Telefonnummer" bind:value={client.phone} name="phone" {errors} />

	<Dropdown
		id="primary_trainer"
		label="Primär tränare"
		placeholder="Välj tränare"
		options={$users.map((user) => ({
			label: `${user.firstname} ${user.lastname}`,
			value: user.id
		}))}
		bind:selectedValue={client.primary_trainer_id}
		{errors}
	/>

	<label class="mt-2 flex items-center gap-2 text-sm font-medium text-gray">
		<input type="checkbox" bind:checked={client.active} class="h-4 w-4" />
		Aktiv
	</label>

	{#if errors.general}
		<p class="text-sm font-medium text-error">{errors.general}</p>
	{/if}

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
