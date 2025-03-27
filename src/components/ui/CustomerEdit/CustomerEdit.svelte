<script lang="ts">
	import Button from '../../bits/button/Button.svelte';
	import { loadingStore } from '$lib/stores/loading';
	import { addNotification } from '$lib/stores/notificationStore';
	import { AppNotificationType } from '$lib/types/notificationTypes';
	import Input from '../../bits/Input/Input.svelte';

	export let customer;
	export let onSave: () => void;

	let form = {
		name: customer.name,
		email: customer.email,
		phone: customer.phone,
		customer_no: customer.customer_no,
		organization_number: customer.organization_number,
		invoice_address: customer.invoice_address,
		invoice_zip: customer.invoice_zip,
		invoice_city: customer.invoice_city,
		invoice_reference: customer.invoice_reference,
		active: customer.active
	};

	let errors = {};

	async function save() {
		loadingStore.loading(true, 'Sparar kund...');
		try {
			const res = await fetch(`/api/customers/${customer.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(form)
			});

			if (!res.ok) throw new Error('Kunde inte spara kund');

			addNotification({
				type: AppNotificationType.SUCCESS,
				message: 'Kund uppdaterad',
				description: `${form.name} uppdaterades korrekt.`
			});
			onSave();
		} catch (e) {
			console.error(e);
			addNotification({
				type: AppNotificationType.CANCEL,
				message: 'Fel vid sparande',
				description: 'Något gick fel vid uppdatering av kund.'
			});
		} finally {
			loadingStore.loading(false);
		}
	}
</script>

<!-- UI -->
<div class="space-y-4">
	<Input label="Namn" name="name" bind:value={form.name} {errors} />
	<Input label="Email" name="email" type="email" bind:value={form.email} {errors} />
	<Input label="Telefon" name="phone" bind:value={form.phone} {errors} />
	<Input label="Kundnummer" name="customer_no" bind:value={form.customer_no} {errors} />
	<Input
		label="Organisationsnummer"
		name="organization_number"
		bind:value={form.organization_number}
		{errors}
	/>
	<Input label="Fakturaadress" name="invoice_address" bind:value={form.invoice_address} {errors} />
	<Input label="Postnummer" name="invoice_zip" bind:value={form.invoice_zip} {errors} />
	<Input label="Stad" name="invoice_city" bind:value={form.invoice_city} {errors} />
	<Input label="Referens" name="invoice_reference" bind:value={form.invoice_reference} {errors} />

	<div class="flex items-center gap-2">
		<label class="text-sm">Aktiv</label>
		<input type="checkbox" bind:checked={form.active} class="h-4 w-4" />
	</div>

	<div class="flex justify-end">
		<Button text="Spara kund" on:click={save} variant="primary" />
	</div>
</div>
