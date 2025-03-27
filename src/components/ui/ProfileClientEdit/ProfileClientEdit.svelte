<script lang="ts">
	import { onMount } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import Input from '../../bits/Input/Input.svelte';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Button from '../../bits/button/Button.svelte';

	export let client;
	export let onSave: () => void;

	// Fetch available trainers
	onMount(fetchUsers);
</script>

<div class="rounded-lg bg-white">
	<!-- Input Fields -->
	<Input label="Förnamn" bind:value={client.firstname} />
	<Input label="Efternamn" bind:value={client.lastname} />
	<Input label="Personnummer" bind:value={client.person_number} />
	<Input label="E-post" bind:value={client.email} />
	<Input label="Alternativ e-post" bind:value={client.alternative_email} />
	<Input label="Telefonnummer" bind:value={client.phone} />

	<!-- Dropdown: Primary Trainer -->
	<Dropdown
		id="primary_trainer"
		label="Primär tränare"
		placeholder="Välj tränare"
		options={$users.map((user) => ({
			label: `${user.firstname} ${user.lastname}`,
			value: user.id
		}))}
		bind:selectedValue={client.primary_trainer_id}
	/>

	<!-- Checkbox: Active -->
	<label class="mt-4 flex items-center gap-2 text-sm font-medium text-gray">
		<input type="checkbox" bind:checked={client.active} class="h-4 w-4" />
		Aktiv
	</label>

	<!-- Save Button -->
	<div class="mt-6">
		<Button text="Spara" variant="primary" on:click={onSave} />
	</div>
</div>
