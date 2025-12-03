<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Icon from '../../../../components/bits/icon-component/Icon.svelte';
	import Button from '../../../../components/bits/button/Button.svelte';
	import Navigation from '../../../../components/bits/navigation/Navigation.svelte';
	import PackagePopup from '../../../../components/ui/packagePopup/PackagePopup.svelte';
	import { openPopup, closePopup } from '$lib/stores/popupStore';

	import OverviewTab from '../../../../components/ui/packages/details/OverviewTab.svelte';
	import BookingsTab from '../../../../components/ui/packages/details/BookingsTab.svelte';
	import NotesTab from '../../../../components/ui/packages/details/NotesTab.svelte';

	let packageId: number;
	let pkg: any = null;
	let loading = true;
	let error: string | null = null;

	// Freeze state
	let showFreeze = false;
	let freezeDate = new Date().toISOString().slice(0, 10);
	let freezeErr: string | null = null;
	let freezePending = false;

	// Invoice number state
	let showInvoice = false;
	let invoiceNo = '';
	let invoiceErr: string | null = null;
	let invoicePending = false;

	// Delete state
	let showDelete = false;
	let deleteErr: string | null = null;
	let deletePending = false;

	$: packageId = Number($page.params.id);

	function fmtKr(n?: number) {
		if (typeof n !== 'number' || Number.isNaN(n)) return '—';
		return `${n.toLocaleString('sv-SE')} kr`;
	}
	function fmtDate(iso?: string) {
		return iso ?? '—';
	}

	async function fetchPkg() {
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/packages/${packageId}`);
			if (!res.ok) throw new Error(await res.text());
			pkg = await res.json();
			freezeDate = new Date().toISOString().slice(0, 10);
		} catch (e: any) {
			error = e?.message ?? 'Kunde inte hämta paket';
		} finally {
			loading = false;
		}
	}
	onMount(fetchPkg);

	async function confirmFreeze() {
		freezeErr = null;
		freezePending = true;
		try {
			const res = await fetch(`/api/packages/${packageId}/freeze`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ frozen_from_date: freezeDate })
			});
			if (!res.ok) {
				const t = await res.text();
				let msg = t;
				try {
					const parsed = JSON.parse(t);
					msg = parsed?.error || t;
				} catch {
					// ignore, keep raw text
				}
				throw new Error(msg);
			}
			showFreeze = false;
			await fetchPkg();
		} catch (e: any) {
			freezeErr = e?.message ?? 'Något gick fel';
		} finally {
			freezePending = false;
		}
	}

	async function addInvoiceNo() {
		invoiceErr = null;
		invoicePending = true;
		try {
			const num = Number(invoiceNo);
			if (!invoiceNo || Number.isNaN(num)) throw new Error('Ogiltigt fakturanummer');
			const res = await fetch(`/api/packages/${packageId}/invoice-number`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ invoice_no: num })
			});
			if (!res.ok) {
				const t = await res.text();
				let msg = t;
				try {
					const parsed = JSON.parse(t);
					msg = parsed?.error || t;
				} catch {
					// ignore
				}
				throw new Error(msg);
			}
			showInvoice = false;
			invoiceNo = '';
			await fetchPkg();
		} catch (e: any) {
			invoiceErr = e?.message ?? 'Något gick fel';
		} finally {
			invoicePending = false;
		}
	}

	async function deletePackage() {
		deleteErr = null;
		deletePending = true;
		try {
			const res = await fetch(`/api/packages/${packageId}`, { method: 'DELETE' });
			if (!res.ok) {
				const t = await res.text();
				let msg = t;
				try {
					const parsed = JSON.parse(t);
					msg = parsed?.error || t;
				} catch {
					// ignore
				}
				throw new Error(msg);
			}
			window.history.back();
		} catch (e: any) {
			deleteErr = e?.message ?? 'Något gick fel';
		} finally {
			deletePending = false;
		}
	}

	async function moveToCustomer() {
		const res = await fetch(`/api/packages/${packageId}/move-to-customer`, { method: 'POST' });
		if (!res.ok) {
			const t = await res.text();
			let msg = t;
			try {
				const parsed = JSON.parse(t);
				msg = parsed?.error || t;
			} catch {
				// ignore
			}
			throw new Error(msg);
		}
		await fetchPkg();
	}

	async function handlePackageSaved() {
		closePopup();
		await fetchPkg();
	}

	function openEditPopup() {
		if (!pkg) return;
		openPopup({
			header: 'Ändra paket',
			icon: 'Pen',
			component: PackagePopup,
			width: '1000px',
			props: {
				mode: 'edit',
				packageId,
				customerId: pkg.customer?.id ?? null,
				initialPackage: {
					id: pkg.id,
					article: pkg.article,
					customer: pkg.customer,
					client: pkg.client,
					paid_price: pkg.paid_price,
					invoice_no: pkg.invoice_no,
					invoice_numbers: pkg.invoice_numbers,
					first_payment_date: pkg.first_payment_date,
					autogiro: pkg.autogiro,
					installments: pkg.installments,
					installments_summary: pkg.installments_summary
				},
				onSave: handlePackageSaved
			}
		});
	}

	const todayISO = new Date().toISOString().slice(0, 10);

	// Navigation config (like /reports)
	const menuItems = [
		{ label: 'Paket', icon: 'Package', component: OverviewTab },
		{ label: 'Bokningar', icon: 'Calendar', component: BookingsTab },
		{ label: 'Anteckningar', icon: 'Notes', component: NotesTab }
	];
	let selectedTab = menuItems[0];
</script>

<!-- Header -->
<div class="m-4 flex flex-wrap items-center justify-between gap-2">
	<div class="flex items-center gap-2">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Package" size="18px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">
			{loading ? 'Laddar…' : (pkg?.article?.name ?? 'Paket')}
		</h2>
	</div>

	<div class="flex flex-wrap gap-2">
		{#if pkg?.client}
			<Button
				text="Flytta till kund"
				icon="ArrowRightLeft"
				variant="secondary"
				on:click={moveToCustomer}
			/>
		{/if}
		{#if pkg?.frozen_from_date}
			<Button
				text="Ta bort frysning"
				icon="X"
				variant="secondary"
				on:click={async () => {
					await fetch(`/api/packages/${packageId}/unfreeze`, { method: 'POST' });
					await fetchPkg();
				}}
			/>
		{:else}
			<Button
				text="Frys paket"
				icon="Snowflake"
				variant="secondary"
				disabled={!pkg?.freeze?.allowed}
				on:click={() => (showFreeze = true)}
			/>
		{/if}
		<Button text="Ändra" icon="Pen" variant="primary" on:click={openEditPopup} />
		<Button text="Ta bort" icon="Trash" variant="danger" on:click={() => (showDelete = true)} />
	</div>
</div>

<div class="m-4 flex flex-col gap-3">
	{#if error}
		<p class="text-red-600">{error}</p>
	{:else if loading}
		<p class="text-gray-600">Laddar paket…</p>
	{:else}
		{#if pkg?.frozen_from_date}
			<div class="rounded-sm border border-yellow-300 bg-yellow-50 p-3 text-yellow-900">
				<strong>Paketet är fryst från och med {pkg.frozen_from_date}.</strong>
			</div>
		{/if}

		{#if pkg?.overbooked}
			<div class="rounded-sm border border-red-300 bg-red-50 p-3 text-red-800">
				<strong>OBS!</strong> Paketet har för många bokningar. Koppla bort bokningar eller uppgradera.
			</div>
		{/if}

		{#if pkg?.valid_to && pkg.valid_to < todayISO && pkg.remaining_sessions > 0}
			<div class="rounded-sm border border-yellow-300 bg-yellow-50 p-3 text-yellow-900">
				<p>
					<strong>Giltighetstiden har gått ut men {pkg.remaining_sessions} pass återstår.</strong>
					Uppgradera paketet under <em>Ändra</em> för att kunna använda återstående pass.
				</p>
			</div>
		{/if}

		{#if pkg?.locked_installments > 0}
			<div class="rounded-sm border border-red-200 bg-red-50 p-2 text-sm text-red-800">
				<strong>OBS!</strong> Vissa faktureringstillfällen ligger i passerade månader och kan vara låsta.
			</div>
		{/if}
	{/if}
</div>

<!-- 🔀 Navigation-driven tabs -->
{#if !loading && pkg}
	<Navigation {menuItems} bind:selectedTab>
		<!-- We pass live props into the selected component -->
		<svelte:component
			this={selectedTab.component}
			{pkg}
			{fmtKr}
			{fmtDate}
			{packageId}
			showClientColumn={!pkg.client}
			on:addinvoice={() => (showInvoice = true)}
			on:changed={fetchPkg}
		/>
	</Navigation>
{/if}
<!-- Freeze modal -->
{#if showFreeze}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-md rounded-sm bg-white p-5 shadow-xl">
			<div class="mb-3 flex items-center gap-2">
				<Icon icon="Snowflake" size="18px" />
				<h3 class="text-lg font-semibold">Frys paket</h3>
			</div>
			<p class="mb-3 text-sm text-gray-700">
				Ange datum för att frysa paketet. Framtida faktureringar tas bort från och med detta datum,
				och inga pass kan bokas mot paketet.
			</p>
			<label class="mb-2 block text-sm font-medium">Datum</label>
			<input class="mb-3 w-full rounded-sm border p-2" type="date" bind:value={freezeDate} />
			{#if freezeErr}<p class="mb-2 text-sm text-red-600">{freezeErr}</p>{/if}
			<div class="mt-4 flex justify-end gap-2">
				<Button text="Avbryt" variant="ghost" on:click={() => (showFreeze = false)} />
				<Button
					text="Frys paketet"
					variant="primary"
					icon="Snowflake"
					disabled={freezePending}
					on:click={confirmFreeze}
				/>
			</div>
		</div>
	</div>
{/if}

<!-- Add invoice number modal -->
{#if showInvoice}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-md rounded-sm bg-white p-5 shadow-xl">
			<div class="mb-3 flex items-center gap-2">
				<Icon icon="FileText" size="18px" />
				<h3 class="text-lg font-semibold">Lägg till fakturanummer</h3>
			</div>
			<label class="mb-2 block text-sm font-medium">Fakturanummer</label>
			<input class="mb-3 w-full rounded-sm border p-2" type="number" bind:value={invoiceNo} />
			{#if invoiceErr}<p class="mb-2 text-sm text-red-600">{invoiceErr}</p>{/if}
			<div class="mt-4 flex justify-end gap-2">
				<Button text="Avbryt" variant="ghost" on:click={() => (showInvoice = false)} />
				<Button
					text="Lägg till"
					variant="primary"
					icon="Plus"
					disabled={invoicePending}
					on:click={addInvoiceNo}
				/>
			</div>
		</div>
	</div>
{/if}

<!-- Delete confirm modal -->
{#if showDelete}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div class="w-full max-w-md rounded-sm bg-white p-5 shadow-xl">
			<div class="mb-3 flex items-center gap-2">
				<Icon icon="Trash" size="18px" />
				<h3 class="text-lg font-semibold">Ta bort paket</h3>
			</div>
			<p class="text-sm">Är du säker på att du vill ta bort paketet? Detta kan inte ångras.</p>
			{#if deleteErr}<p class="mt-2 text-sm text-red-600">{deleteErr}</p>{/if}
			<div class="mt-4 flex justify-end gap-2">
				<Button text="Avbryt" variant="ghost" on:click={() => (showDelete = false)} />
				<Button
					text="Ta bort"
					variant="danger"
					icon="Trash"
					disabled={deletePending}
					on:click={deletePackage}
				/>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Your Navigation component styles handle the rest */
</style>
