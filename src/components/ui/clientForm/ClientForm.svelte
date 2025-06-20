<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { loadingStore } from '$lib/stores/loading';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import Input from '../../bits/Input/Input.svelte';
	import Button from '../../bits/button/Button.svelte';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import InfoButton from '../../bits/infoButton/InfoButton.svelte';

	const dispatch = createEventDispatcher();

	let firstname = '';
	let lastname = '';
	let email = '';
	let phone = '';
	let person_number = '';
	let primary_trainer_id: number | null = null;
	let createdClientId: number | null = null;
	let errors: Record<string, string> = {};
	let active = true;

	$: isLoading = $loadingStore.isLoading;

	onMount(fetchUsers);

	$: trainerOptions = ($users || []).map((user) => ({
		label: `${user.firstname} ${user.lastname}`,
		value: user.id
	}));

	async function handleSubmit() {
		errors = {};

		if (!firstname) errors.firstname = 'Förnamn krävs';
		if (!lastname) errors.lastname = 'Efternamn krävs';
		if (!email) errors.email = 'E-post krävs';

		if (Object.keys(errors).length > 0) return;

		try {
			loadingStore.loading(true, 'Skapar klient...');

			const res = await fetch('/api/create-client', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					firstname,
					lastname,
					email,
					phone,
					person_number,
					primary_trainer_id,
					active
				})
			});

			const data = await res.json();

			if (!res.ok) {
				errors = data.errors || { general: 'Något gick fel vid skapandet' };
				return;
			}

			createdClientId = data.clientId;
			dispatch('created', data);
		} catch (err) {
			console.error(err);
			errors.general = 'Kunde inte skapa klient. Försök igen.';
		} finally {
			loadingStore.loading(false);
		}
	}
</script>

{#if createdClientId}
	<div class="mb-4 rounded-lg border border-success bg-green-50 p-6 text-success">
		<h2 class="text-xl font-semibold">Klient skapad!</h2>
		<p class="mt-2">
			Klienten har skapats. Du kan nu gå till
			<a
				href={`/clients/${createdClientId}`}
				class="text-success underline hover:text-success-hover"
			>
				kundens profilsida
			</a>.
		</p>
	</div>
	<Button
		text="Skapa ny klient"
		iconRight="Plus"
		iconRightSize="16"
		variant="primary"
		full
		on:click={() => {
			firstname = '';
			lastname = '';
			email = '';
			phone = '';
			person_number = '';
			primary_trainer_id = null;
			createdClientId = null;
			active = true;
		}}
	/>
{:else}
	<div class="flex min-w-[350px] flex-col gap-2 md:w-[600px]">
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
			<Input
				label="Personnummer"
				name="person_number"
				bind:value={person_number}
				placeholder="yymmdd-xxxx"
			/>
		</div>

		<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
			<Input label="E-post" name="email" bind:value={email} placeholder="mail@takkei.se" {errors} />
			<Input label="Telefon" name="phone" bind:value={phone} placeholder="+4670..." />
		</div>

		<Dropdown
			label="Primär tränare"
			placeholder="Välj tränare"
			id="primary_trainer_id"
			options={trainerOptions}
			bind:selectedValue={primary_trainer_id}
			search
		/>

		<div class="mt-2 flex items-center gap-2">
			<Checkbox id="active" name="active" bind:checked={active} label="Aktiv" {errors} />
			<InfoButton
				info="Låt vara inaktiv om klienten endast ska demoträna. Det krävs att klienten är aktiv för att göra riktiga bokningar"
				preferred="right"
				variant="dark"
				letter="?"
			/>
		</div>

		<div class="pt-2">
			<Button
				text="Skapa klient"
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
