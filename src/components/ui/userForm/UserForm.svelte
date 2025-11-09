<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fetchLocations, locations } from '$lib/stores/locationsStore';
	import { loadingStore } from '$lib/stores/loading';

	import Input from '../../bits/Input/Input.svelte';
	import DropdownCheckbox from '../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import Button from '../../bits/button/Button.svelte';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import { user } from '$lib/stores/userStore';
	import { ROLE_OPTIONS } from '$lib/constants/roles';

	onMount(fetchLocations);

	const dispatch = createEventDispatcher();

	let firstname = '';
	let lastname = '';
	let email = '';
	let mobile = '';
	let password = '';
	let default_location_id: number | null = null;

	$: locationOptions = $locations.map((l) => ({
		label: l.name,
		value: l.id
	}));
	$: isLoading = $loadingStore.isLoading;
	let selectedLocation: number | null = null;
	let showPassword = false;
	let errors: Record<string, string> = {};

	let createdUserId: number | null = null;

	const allRoles = ROLE_OPTIONS;
	let selectedRoles: string[] = [];

	function handleRolesSelection(event) {
		selectedRoles = [...event.detail.selected];
	}

	async function handleSubmit() {
		errors = {};

		if (!firstname) errors.firstname = 'Förnamn krävs';
		if (!lastname) errors.lastname = 'Efternamn krävs';
		if (!email) errors.email = 'E-post krävs';
		if (!password) errors.password = 'Lösenord krävs';
		if (!default_location_id) errors.default_location_id = 'Välj en plats';
		if (selectedRoles.length === 0) errors.roles = 'Minst en roll måste väljas';

		if (Object.keys(errors).length > 0) {
			return;
		}

		try {
			loadingStore.loading(true, 'Skapar användare...');

			const res = await fetch('/api/create-user', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					firstname,
					lastname,
					email,
					mobile,
					password,
					default_location_id,
					roles: selectedRoles
				})
			});

			if (!res.ok) {
				const result = await res.json();
				errors = result.errors || { general: 'Något gick fel vid skapandet' };
				return;
			}

			const data = await res.json();
			createdUserId = data.userId;
			dispatch('created', data);
		} catch (error) {
			console.error(error);
			errors.general = 'Kunde inte skapa användaren. Försök igen.';
		} finally {
			loadingStore.loading(false);
		}
	}
</script>

{#if createdUserId}
	<div class="mb-4 rounded-sm border border-success bg-green-50 p-6 text-success">
		<h2 class="text-xl font-semibold">Användare skapad!</h2>
		<p class="mt-2">
			Användaren har skapats. Du kan nu gå till
			<a href={`/users/${createdUserId}`} class="text-success underline hover:text-success-hover">
				användarens profilsida
			</a>.
		</p>
	</div>
	<Button
		text="Skapa ny användare"
		iconRight="Plus"
		iconRightSize="16"
		variant="primary"
		full
		on:click={() => {
			firstname = '';
			lastname = '';
			email = '';
			mobile = '';
			password = '';
			default_location_id = null;
			selectedRoles = [];
			createdUserId = null;
		}}
	/>
{:else}
	<div class="mb-4 flex flex-row items-center justify-between">
		<h2 class="text-xl font-semibold">Ny användare</h2>
	</div>

	<div class="mb-4 flex flex-row items-center justify-between">
		<p class="text-sm text-gray-500">Skapa ny användare</p>
	</div>

	<div class="flex flex-col gap-4">
		<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
			<Input
				label="Förnamn"
				name="firstname"
				bind:value={firstname}
				placeholder="Förnamn"
				{errors}
			/>
			<Input
				label="Efternamn"
				name="lastname"
				bind:value={lastname}
				placeholder="Efternamn"
				{errors}
			/>
		</div>

		<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
			<Input label="E-post" name="email" bind:value={email} placeholder="mail@takkei.se" {errors} />

			<div class="flex items-center gap-2">
				<Input
					type={showPassword ? 'text' : 'password'}
					label="Lösenord"
					name="password"
					bind:value={password}
					placeholder="********"
					{errors}
				/>
				<div class="mt-1 flex flex-row gap-2">
					<Button
						icon={showPassword ? 'EyeOff' : 'Eye'}
						variant="secondary"
						iconSize="18"
						on:click={() => (showPassword = !showPassword)}
					/>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
			<Input label="Mobilnummer" name="mobile" bind:value={mobile} placeholder="+4670..." />
		</div>

		<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
			<Dropdown
				id="default_location_id"
				label="Primär lokal"
				bind:selectedValue={default_location_id}
				options={locationOptions}
				placeholder="Välj en plats"
				{errors}
			/>
			<DropdownCheckbox
				label="Roller"
				id="roles"
				options={allRoles}
				bind:selectedValues={selectedRoles}
				on:change={handleRolesSelection}
			/>
		</div>

		<div class="pt-2">
			<Button
				text="Skapa användare"
				iconRight="Plus"
				iconRightSize="16"
				variant="primary"
				full
				on:click={handleSubmit}
				disabled={isLoading}
			/>
		</div>
		{#if errors.general}
			<p class="text-sm font-medium text-error">{errors.general}</p>
		{/if}
	</div>
{/if}
