<script lang="ts">
	import Button from '../../bits/button/Button.svelte';
	import CustomerEdit from '../CustomerEdit/CustomerEdit.svelte';

	export let customer;

	let isEditing = false;
</script>

<div class="flex flex-col gap-4">
	<div class="rounded-lg bg-white p-6 shadow-md">
		<div class="mb-4 flex items-center justify-between">
			<h4 class="text-xl font-semibold">{!isEditing ? 'Profil' : 'Redigera kund'}</h4>
			<Button
				text={isEditing ? 'Spara' : 'Redigera'}
				on:click={() => (isEditing = !isEditing)}
				variant="primary"
			/>
		</div>

		{#if !isEditing}
			<p class="text-gray-600"><strong>Namn:</strong> {customer.name}</p>
			<p class="text-gray-600"><strong>Email:</strong> {customer.email}</p>
			<p class="text-gray-600"><strong>Telefon:</strong> {customer.phone}</p>
			<p class="text-gray-600"><strong>Kundnummer:</strong> {customer.customer_no || '—'}</p>
			<p class="text-gray-600">
				<strong>Organisationsnummer:</strong>
				{customer.organization_number || '—'}
			</p>
			<p class="text-gray-600"><strong>Fakturaadress:</strong> {customer.invoice_address || '—'}</p>
			<p class="text-gray-600"><strong>Postnummer:</strong> {customer.invoice_zip || '—'}</p>
			<p class="text-gray-600"><strong>Stad:</strong> {customer.invoice_city || '—'}</p>
			<p class="text-gray-600"><strong>Referens:</strong> {customer.invoice_reference || '—'}</p>
			<p class="text-gray-600"><strong>Aktiv:</strong> {customer.active ? 'Ja' : 'Nej'}</p>
		{:else}
			<CustomerEdit {customer} onSave={() => (isEditing = false)} />
		{/if}
	</div>
</div>
