<script lang="ts">
	import Button from '../../bits/button/Button.svelte';
	import ProfileCustomerClients from '../ProfileCustomerClients/ProfileCustomerClients.svelte';
	import CustomerEdit from '../CustomerEdit/CustomerEdit.svelte';
	import Table from '../../bits/table/Table.svelte';
	import { goto } from '$app/navigation';
	import PackagePopup from '../packagePopup/PackagePopup.svelte';
	import { openPopup, closePopup } from '$lib/stores/popupStore';

	export let customer;
	export let onCustomerChange: (value: any) => void = () => {};
	export let refreshCustomer: (() => Promise<void> | void) | null = null;
	let isEditing = false;

	function handleClientsUpdated(event) {
		const updatedClients = event.detail ?? [];
		customer = { ...customer, clients: updatedClients };
		onCustomerChange?.(customer);
	}

	function handleCustomerSaved(updatedCustomer: any) {
		if (updatedCustomer && typeof updatedCustomer === 'object') {
			customer = { ...customer, ...updatedCustomer };
		}
		onCustomerChange?.(customer);
		isEditing = false;
	}

const packageHeaders = [
		{ label: 'Typ', key: 'type' },
		{ label: 'Klient', key: 'client' },
		{ label: 'Fryst', key: 'frozen' },
		{ label: 'Autogiro', key: 'autogiro' },
		{ label: 'Fakturanummer', key: 'invoice_no' },
		{ label: 'Saldo', key: 'saldo' },
		{ label: 'Bokningar', key: 'bookings' }
	];

	const packageTable = customer.packages?.map((pkg) => {
		const totalSessions = pkg.total_sessions ?? null;
		const usedSessions = pkg.used_sessions_total ?? 0;
		const saldoValue =
			pkg.remaining_sessions_today != null ? String(pkg.remaining_sessions_today) : '—';
		const bookingsValue =
			totalSessions != null ? `${usedSessions}/${totalSessions}` : String(usedSessions);

		return {
			id: pkg.id,
			type: [
				{
					type: 'link',
					label: pkg.article?.name || 'Okänd typ',
					// preloads package detail on hover for snappier navigation
					attrs: { 'data-sveltekit-preload-data': 'hover' },
					action: () => goto(`/settings/packages/${pkg.id}`)
				}
			],
			client: [
				pkg.client
					? {
							type: 'link',
							label: `${pkg.client.firstname} ${pkg.client.lastname}`,
							attrs: { 'data-sveltekit-preload-data': 'hover' },
							action: () => goto(`/clients/${pkg.client.id}`)
					}
					: { type: 'text', label: '—' }
			],
			frozen: pkg.frozen_from_date ? 'Ja' : 'Nej',
			autogiro: pkg.autogiro ? 'Ja' : 'Nej',
			invoice_no:
				Array.isArray(pkg.invoice_numbers) && pkg.invoice_numbers.length
					? String(pkg.invoice_numbers[0])
					: '—',
			saldo: saldoValue,
			bookings: bookingsValue
		};
	});

async function handleCreatePackage() {
	closePopup();
	try {
		if (typeof refreshCustomer === 'function') {
			await refreshCustomer();
		}
	} catch (error) {
		console.error('Failed to refresh customer after creating package:', error);
	}
}

function openPackagePopup() {
	openPopup({
		header: 'Lägg till paket',
		icon: 'Plus',
		component: PackagePopup,
		width: '1000px',
		props: {
			customerId: customer.id,
			onSave: handleCreatePackage
		}
	});
}
</script>

<div class="flex flex-col gap-4">
	<!-- 👤 Customer Info -->
	<div class="rounded-sm bg-white p-6 shadow-md">
		<div class="mb-4 flex items-center justify-between">
			<h4 class="text-xl font-semibold">{!isEditing ? 'Profil' : 'Redigera kund'}</h4>
			<Button
				text={isEditing ? 'Avbryt' : 'Redigera'}
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
			<CustomerEdit {customer} onSave={handleCustomerSaved} />
		{/if}
	</div>

	<ProfileCustomerClients
		customerId={customer.id}
		clients={customer.clients ?? []}
		on:clientsUpdated={handleClientsUpdated}
	/>

	<div class="rounded-sm bg-white p-6 shadow-md">
		<div class="mb-4 flex items-center justify-between">
			<h4 class="text-xl font-semibold">Paket</h4>
		<Button
			text="Lägg till paket"
			variant="secondary"
			iconLeft="Plus"
			iconLeftSize="14px"
			on:click={openPackagePopup}
		/>
	</div>

		{#if packageTable?.length > 0}
			<Table headers={packageHeaders} data={packageTable} />
		{:else}
			<p class="text-gray-600">Inga paket kopplade till denna kund.</p>
		{/if}
	</div>
</div>

<!-- Popup handled globally -->
