<script lang="ts">
	import Button from '../../bits/button/Button.svelte';
	import ProfileCustomerClients from '../ProfileCustomerClients/ProfileCustomerClients.svelte';
	import CustomerEdit from '../CustomerEdit/CustomerEdit.svelte';
	import Table from '../../bits/table/Table.svelte';
	import { goto } from '$app/navigation';
	import PackagePopup from '../packagePopup/PackagePopup.svelte';
	import SaldoAdjustmentPopup from '../ProfileClientPackages/SaldoAdjustmentPopup.svelte';
	import { openPopup, closePopup } from '$lib/stores/popupStore';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import { openPackageAssignmentPopup } from '$lib/helpers/packageAssignments/openPackageAssignmentPopup';
	import type { ComponentType } from 'svelte';

	type CustomerPackage = {
		id: number;
		article?: { name?: string | null } | null;
		client?: { id: number; firstname?: string | null; lastname?: string | null } | null;
		frozen_from_date?: string | null;
		autogiro?: boolean | null;
		invoice_numbers?: Array<string | number> | null;
		total_sessions?: number | null;
		used_sessions_total?: number | null;
		remaining_sessions?: number | null;
	};

	type CustomerProfile = {
		id: number;
		name?: string | null;
		email?: string | null;
		phone?: string | null;
		customer_no?: string | number | null;
		organization_number?: string | null;
		invoice_address?: string | null;
		invoice_zip?: string | null;
		invoice_city?: string | null;
		invoice_reference?: string | null;
		active?: boolean | null;
		clients?: any[];
		packages?: CustomerPackage[];
	};

	export let customer: CustomerProfile;
	export let onCustomerChange: (value: any) => void = () => {};
	export let refreshCustomer: (() => Promise<void> | void) | null = null;
	let isEditing = false;
	let recalcPending = false;
	let recalcInfo: string | null = null;
	let recalcError: string | null = null;
	let recalcDetachedCount = 0;
	let isAdmin = false;

	$: isAdmin = hasRole('Administrator');

	function handleClientsUpdated(event: CustomEvent<any[]>) {
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

	$: packageTable = (customer.packages ?? []).map((pkg: CustomerPackage) => {
		const totalSessions = pkg.total_sessions ?? null;
		const usedSessions = pkg.used_sessions_total ?? 0;
		const saldoValue = pkg.remaining_sessions != null ? String(pkg.remaining_sessions) : '—';
		const bookingsValue =
			totalSessions != null ? `${usedSessions}/${totalSessions}` : String(usedSessions);
		const packageClient = pkg.client ?? null;

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
				packageClient
					? {
							type: 'link',
							label: `${packageClient.firstname} ${packageClient.lastname}`,
							attrs: { 'data-sveltekit-preload-data': 'hover' },
							action: () => goto(`/clients/${packageClient.id}`)
						}
					: { type: 'text', content: 'Delat (ingen klient)' }
			],
			frozen: pkg.frozen_from_date ? `Ja (${String(pkg.frozen_from_date).slice(0, 10)})` : 'Nej',
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
			component: PackagePopup as unknown as ComponentType,
			width: '1000px',
			props: {
				customerId: customer.id,
				onSave: handleCreatePackage
			}
		});
	}

	async function recalculateCustomerPackages() {
		recalcPending = true;
		recalcInfo = null;
		recalcError = null;
		recalcDetachedCount = 0;
		try {
			const res = await fetch(`/api/customers/${customer.id}/packages/recalculate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			});

			const text = await res.text();
			let payload: any = null;
			try {
				payload = text ? JSON.parse(text) : null;
			} catch {
				payload = null;
			}

			if (!res.ok) throw new Error(payload?.error || text || 'Kunde inte räkna om paket');

			recalcInfo =
				payload?.message ||
				`Räknade om ${payload?.processedPackages ?? 0} paket och kopplade bort ${payload?.totalDetachedCount ?? 0} bokningar.`;
			recalcDetachedCount = Number(payload?.totalDetachedCount ?? 0);

			if (typeof refreshCustomer === 'function') {
				await refreshCustomer();
			}
		} catch (error: any) {
			recalcError = error?.message ?? 'Kunde inte räkna om paket';
		} finally {
			recalcPending = false;
		}
	}

	function openAssignmentPopup(initialFilter: 'all' | 'linked' | 'missing' = 'all') {
		if (!customer?.id || !isAdmin) return;
		openPackageAssignmentPopup({
			scope: 'customer',
			scopeId: customer.id,
			initialFilter,
			onApplied: async () => {
				if (typeof refreshCustomer === 'function') {
					await refreshCustomer();
				}
			}
		});
	}

	function openSaldoAdjustmentPopup() {
		if (!customer?.id || !isAdmin) return;
		openPopup({
			header: 'Saldojustering',
			icon: 'Calculator',
			component: SaldoAdjustmentPopup as unknown as ComponentType,
			maxWidth: '560px',
			props: {
				customerId: customer.id
			},
			listeners: {
				saved: async () => {
					if (typeof refreshCustomer === 'function') {
						await refreshCustomer();
					}
				}
			},
			closeOn: ['saved']
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
			<div class="flex flex-wrap gap-2">
				{#if isAdmin}
					<Button
						text="Saldojustering"
						variant="secondary"
						iconLeft="Calculator"
						iconLeftSize="14px"
						on:click={openSaldoAdjustmentPopup}
					/>
					<Button
						text="Hantera paketbokningar"
						variant="secondary"
						iconLeft="Package"
						iconLeftSize="14px"
						on:click={() => openAssignmentPopup()}
					/>
				{/if}
				<Button
					text="Räkna om alla paket"
					variant="secondary"
					iconLeft="Refresh"
					iconLeftSize="14px"
					disabled={recalcPending}
					confirmOptions={{
						title: 'Räkna om kundens paket?',
						description:
							'Detta kopplar bort överflödiga eller paketfria bokningar från alla paket på kunden.',
						actionLabel: 'Räkna om',
						action: recalculateCustomerPackages
					}}
				/>
				<Button
					text="Lägg till paket"
					variant="secondary"
					iconLeft="Plus"
					iconLeftSize="14px"
					on:click={openPackagePopup}
				/>
			</div>
		</div>

		{#if recalcInfo}
			<div
				class="mb-4 flex flex-col gap-3 rounded-sm border border-green-300 bg-green-50 p-3 text-green-900 md:flex-row md:items-center md:justify-between"
			>
				<p>{recalcInfo}</p>
				{#if isAdmin && recalcDetachedCount > 0}
					<Button
						text="Hantera bokningar utan paket"
						variant="secondary"
						small
						on:click={() => openAssignmentPopup('missing')}
					/>
				{/if}
			</div>
		{/if}
		{#if recalcError}
			<div class="mb-4 rounded-sm border border-red-300 bg-red-50 p-3 text-red-800">
				<strong>Omräkning misslyckades:</strong>
				{recalcError}
			</div>
		{/if}

		{#if packageTable?.length > 0}
			<Table headers={packageHeaders} data={packageTable} />
		{:else}
			<p class="text-gray-600">Inga paket kopplade till denna kund.</p>
		{/if}
	</div>
</div>

<!-- Popup handled globally -->
