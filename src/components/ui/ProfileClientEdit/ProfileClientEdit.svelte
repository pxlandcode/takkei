<script lang="ts">
	import { onMount } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { fetchLocations, locations } from '$lib/stores/locationsStore';
	import Input from '../../bits/Input/Input.svelte';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { loadingStore } from '$lib/stores/loading';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	export let client;
	export let onSave: (updated?: any) => void = () => {};

	let errors: Record<string, string> = {};
	let newPassword = '';
	let confirmPassword = '';

	onMount(() => {
		fetchUsers();
		fetchLocations();
	});

	$: locationOptions = $locations.map((location) => ({
		label: location.name,
		value: location.id
	}));

	async function handleSave() {
		errors = {};
		try {
			loadingStore.loading(true, 'Sparar ändringar...');

			const trimmedPassword = newPassword.trim();
			const trimmedConfirm = confirmPassword.trim();
			if (trimmedPassword || trimmedConfirm) {
				if (trimmedPassword.length < 8) {
					errors.password = 'Lösenordet måste vara minst 8 tecken';
				}
				if (trimmedPassword !== trimmedConfirm) {
					errors.password_confirm = 'Lösenorden matchar inte';
				}
			}

			if (Object.keys(errors).length > 0) {
				return;
			}

			const res = await fetch(`/api/clients/${client.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...client,
					primary_location_id: client.primary_location_id ?? null,
					password: trimmedPassword || undefined
				})
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

			if (result && typeof result === 'object') {
				Object.assign(client, result);
			}

			newPassword = '';
			confirmPassword = '';

			onSave(result);
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
		id="primary_location"
		label="Primär lokal"
		placeholder="Välj plats"
		options={locationOptions}
		bind:selectedValue={client.primary_location_id}
		{errors}
	/>

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

	<div class="rounded-sm border border-gray-200 p-4">
		<p class="mb-2 text-sm font-semibold text-gray-700">Byt lösenord</p>
		<p class="mb-4 text-xs text-gray-500">Lämna fälten tomma om du vill behålla nuvarande lösenord.</p>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<Input
				label="Nytt lösenord"
				name="password"
				type="password"
				bind:value={newPassword}
				{errors}
			/>
			<Input
				label="Bekräfta nytt lösenord"
				name="password_confirm"
				type="password"
				bind:value={confirmPassword}
				{errors}
			/>
		</div>
	</div>

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
