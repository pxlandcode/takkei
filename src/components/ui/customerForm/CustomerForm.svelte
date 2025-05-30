<script lang="ts">
	import { onMount } from 'svelte';
	import Input from '../../bits/Input/Input.svelte';
	import DropdownCheckbox from '../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import FilterBox from '../../bits/filterBox/FilterBox.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { loadingStore } from '$lib/stores/loading';

	export let customerId: number | null = null;

	let name = '';
	let email = '';
	let phone = '';
	let invoice_address = '';
	let invoice_zip = '';
	let invoice_city = '';
	let organization_number = '';

	let selectedClients = [];
	let allClients = [];

	$: isLoading = $loadingStore.isLoading;

	let errors: Record<string, string> = {};

	onMount(async () => {
		const url = customerId
			? `/api/clients?customerId=${customerId}&available=true&short=true`
			: `/api/clients?available=true&short=true`;

		const res = await fetch(url);
		allClients = await res.json();
	});

	function removeClient(id: number) {
		selectedClients = selectedClients.filter((c) => c.id !== id);
	}

	function handleClientSelection(event) {
		selectedClients = [...event.detail.selected];
		console.log('Selected clients:', selectedClients);
	}

	async function handleSubmit() {
		errors = {}; // reset

		if (!name) errors.name = 'Namn krävs';

		try {
			loadingStore.loading(true, 'Skapar kund...');

			const res = await fetch('/api/create-customer', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					email,
					phone,
					invoice_address,
					invoice_zip,
					invoice_city,
					organization_number,
					clientIds: selectedClients.map((c) => c.id)
				})
			});

			const result = await res.json();

			if (!res.ok) {
				errors = result.errors || { general: 'Något gick fel vid skapande av kund' };
				addToast({
					type: AppToastType.CANCEL,
					message: 'Fel vid skapande',
					description: errors.general || 'Valideringsfel'
				});
				return;
			}

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Kund skapad',
				description: `${name} skapades korrekt.`
			});

			// Clear form
			name = '';
			email = '';
			phone = '';
			invoice_address = '';
			invoice_zip = '';
			invoice_city = '';
			organization_number = '';
			selectedClients = [];
			allClients = [];
		} catch (err) {
			console.error('Request failed', err);
			errors.general = 'Något gick fel vid skapande av kund.';
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid skapande',
				description: errors.general
			});
		} finally {
			loadingStore.loading(false);
		}
	}
</script>

<div class="flex min-w-[350px] flex-col gap-2 md:w-[600px]">
	<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
		<Input label="Namn" name="name" bind:value={name} {errors} />
		<Input
			label="Organisationsnummer/Personnummer"
			name="organization_number"
			bind:value={organization_number}
		/>
	</div>

	<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
		<Input label="E-post" name="email" bind:value={email} {errors} />
		<Input label="Telefon" name="phone" bind:value={phone} {errors} />
	</div>

	<Input label="Fakturaadress" name="invoice_address" bind:value={invoice_address} {errors} />

	<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
		<Input label="Postnummer" name="invoice_zip" bind:value={invoice_zip} {errors} />
		<Input label="Stad" name="invoice_city" bind:value={invoice_city} {errors} />
	</div>

	<DropdownCheckbox
		label="Lägg till klienter"
		id="clients"
		options={allClients.map((c) => ({
			name: `${c.firstname} ${c.lastname}`,
			value: c
		}))}
		bind:selectedValues={selectedClients}
		on:change={handleClientSelection}
		openPosition="up"
		search
		disabled={allClients.length === 0}
		infiniteScroll
	/>

	<FilterBox
		title="Valda klienter"
		{selectedClients}
		on:removeFilter={(e) => removeClient(e.detail.id)}
	/>

	<Button
		text="Skapa kund"
		variant="primary"
		on:click={handleSubmit}
		disabled={loadingStore.loading}
	/>
</div>
