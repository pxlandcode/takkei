<script lang="ts">
	import { onMount } from 'svelte';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import DropdownCheckbox from '../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import Button from '../../bits/button/Button.svelte';
	import TextArea from '../../bits/textarea/TextArea.svelte';
	import { loadingStore } from '$lib/stores/loading';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { ROLE_OPTIONS } from '$lib/constants/roles';

	export let trainer;
	export let onSave;

	let errors: Record<string, string> = {};
	let selectedRoles: string[] = trainer?.roles?.map((role) => role.name) ?? [];
	let lastTrainerId: number | null = trainer?.id ?? null;

	onMount(fetchLocations);

	$: if (trainer && trainer.comment == null) {
		trainer.comment = '';
	}

	$: if (trainer?.id !== lastTrainerId) {
		selectedRoles = trainer?.roles?.map((role) => role.name) ?? [];
		lastTrainerId = trainer?.id ?? null;
	}

	function handleRolesSelection(event) {
		selectedRoles = [...event.detail.selected];
		if (errors.roles) {
			const { roles, ...rest } = errors;
			errors = rest;
		}
	}

	async function handleSave() {
		errors = {};
		try {
			if (!trainer.firstname) errors.firstname = 'Förnamn krävs';
			if (!trainer.lastname) errors.lastname = 'Efternamn krävs';
			if (!trainer.email) errors.email = 'E-post krävs';
			if (selectedRoles.length === 0) errors.roles = 'Minst en roll måste väljas';

			if (Object.keys(errors).length > 0) {
				return;
			}

			loadingStore.loading(true, 'Sparar ändringar...');

			const payload = {
				firstname: trainer.firstname,
				lastname: trainer.lastname,
				initials: trainer.initials,
				email: trainer.email,
				mobile: trainer.mobile,
				default_location_id: trainer.default_location_id ?? null,
				active: trainer.active,
				comment: trainer.comment ?? '',
				roles: selectedRoles
			};

			let res = await fetch(`/api/users/${trainer.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
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

			if (result.user) {
				Object.assign(trainer, result.user);
				selectedRoles = result.user.roles?.map((role) => role.name) ?? [];
			} else {
				trainer.roles = selectedRoles.map((name, idx) => ({
					id: trainer.roles?.[idx]?.id ?? idx,
					user_id: trainer.id,
					name,
					created_at: '',
					updated_at: ''
				}));
			}

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Profil uppdaterad',
				description: `${trainer.firstname} ${trainer.lastname} har uppdaterats korrekt.`
			});

			if (onSave) onSave(result.user);
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
	<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
		<Input label="Förnamn" bind:value={trainer.firstname} name="firstname" {errors} />
		<Input label="Efternamn" bind:value={trainer.lastname} name="lastname" {errors} />
	</div>

	<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
		<Input label="Initialer" bind:value={trainer.initials} name="initials" {errors} />
		<Input label="E-post" bind:value={trainer.email} name="email" {errors} />
	</div>

	<Input label="Mobiltelefon" bind:value={trainer.mobile} name="mobile" {errors} />

	<Dropdown
		id="default_location_id"
		label="Primär Lokal"
		placeholder="Välj plats"
		options={$locations.map((loc) => ({ label: loc.name, value: loc.id }))}
		bind:selectedValue={trainer.default_location_id}
		{errors}
	/>

	<div class="flex items-center gap-2">
		<input type="checkbox" bind:checked={trainer.active} class="h-4 w-4" />
		<span class="text-sm font-medium text-gray">Aktiv</span>
	</div>

	<DropdownCheckbox
		label="Roller"
		id="roles"
		options={ROLE_OPTIONS}
		bind:selectedValues={selectedRoles}
		on:change={handleRolesSelection}
		error={Boolean(errors.roles)}
		errorMessage={errors.roles}
	/>

	<TextArea label="Intern anteckning" name="comment" bind:value={trainer.comment} />

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
