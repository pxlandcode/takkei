<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import DatePicker from '../../bits/datePicker/DatePicker.svelte';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import { closePopup } from '$lib/stores/popupStore';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	type ClientPackage = {
		id: number;
		article: { id: number | null; name: string };
		customer: { id: number; name: string };
		is_active: boolean;
		remaining_sessions_today: number | null;
		remaining_sessions: number | null;
	};

	type ClientOption = {
		id: number;
		name: string;
	};

	export let clientId: number | null = null;
	export let packageId: number | null = null;
	export let customerId: number | null = null;
	export let packageLocked = false;

	const dispatch = createEventDispatcher<{ saved: { createdCount: number } }>();

	let date = stockholmToday();
	let count = '1';
	let packages: ClientPackage[] = [];
	let clients: ClientOption[] = [];
	let selectedClientId = clientId ? String(clientId) : '';
	let selectedPackageId = packageId ? String(packageId) : '';
	let loadingPackages = false;
	let loadingClients = false;
	let saving = false;
	let formError: string | null = null;
	let errors: Record<string, string> = {};
	let loadedPackagesKey: string | null = null;

	$: currentClientId = toPositiveId(selectedClientId);
	$: allowClientSelection = !clientId && Boolean(customerId);
	$: customerScopedPackages = filterPackagesForContext(packages);
	$: selectedPackage =
		customerScopedPackages.find((pkg) => String(pkg.id) === String(selectedPackageId)) ?? null;
	$: packageOptions = customerScopedPackages.map((pkg) => ({
		label: packageLabel(pkg),
		value: String(pkg.id),
		unavailable:
			typeof pkg.remaining_sessions === 'number' && Number(count) > pkg.remaining_sessions
	}));
	$: clientOptions = clients.map((client) => ({ label: client.name, value: String(client.id) }));

	function stockholmToday() {
		return new Intl.DateTimeFormat('sv-SE', {
			timeZone: 'Europe/Stockholm',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).format(new Date());
	}

	function toPositiveId(value: unknown) {
		const parsed = Number(value);
		return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
	}

	function formatSaldo(value: number | null) {
		if (value === null || Number.isNaN(Number(value))) return 'okänt saldo';
		return `${value} pass`;
	}

	function packageLabel(pkg: ClientPackage) {
		const article = pkg.article?.name ?? 'Okänt paket';
		const customer = pkg.customer?.name ?? 'Okänd kund';
		const saldo = formatSaldo(pkg.remaining_sessions);
		return `${article} - ${customer} (saldo: ${saldo})`;
	}

	function filterPackagesForContext(rows: ClientPackage[]) {
		if (!customerId || packageId) return rows;
		return rows.filter((pkg) => Number(pkg.customer?.id) === Number(customerId));
	}

	function parseErrorPayload(text: string, fallback: string) {
		try {
			const parsed = JSON.parse(text);
			return parsed?.error || fallback;
		} catch {
			return text || fallback;
		}
	}

	async function loadClientsForCustomer() {
		if (!allowClientSelection || !customerId) return;

		loadingClients = true;
		formError = null;
		try {
			const res = await fetch(`/api/customers/${customerId}/clients`);
			const text = await res.text();
			if (!res.ok) throw new Error(parseErrorPayload(text, 'Kunde inte hämta klienter.'));
			const payload = text ? JSON.parse(text) : null;
			clients = Array.isArray(payload) ? payload : (payload?.clients ?? []);
			if (clients.length === 1) {
				selectedClientId = String(clients[0].id);
				await loadPackagesForDate();
			}
		} catch (error: any) {
			formError = error?.message ?? 'Kunde inte hämta klienter.';
			clients = [];
		} finally {
			loadingClients = false;
		}
	}

	async function loadPackagesForDate() {
		const targetClientId = toPositiveId(selectedClientId);
		if (!targetClientId || !date) return;
		const loadKey = `${targetClientId}:${date}`;
		if (loadKey === loadedPackagesKey) return;

		loadingPackages = true;
		formError = null;
		try {
			const res = await fetch(
				`/api/clients/${targetClientId}/packages?date=${encodeURIComponent(date)}&eligibleOnly=true`
			);
			if (!res.ok) throw new Error(await res.text());
			packages = await res.json();
			loadedPackagesKey = loadKey;

			const scopedPackages = filterPackagesForContext(packages);
			const hasCurrentSelection = scopedPackages.some(
				(pkg) => String(pkg.id) === String(selectedPackageId)
			);
			const hasRequestedPackage = scopedPackages.some((pkg) => pkg.id === packageId);
			if (!hasCurrentSelection) {
				selectedPackageId =
					packageId && hasRequestedPackage
						? String(packageId)
						: String((scopedPackages.find((pkg) => pkg.is_active) ?? scopedPackages[0])?.id ?? '');
			}
		} catch (error: any) {
			formError = error?.message ?? 'Kunde inte hämta paket för valt datum.';
			packages = [];
			selectedPackageId = '';
		} finally {
			loadingPackages = false;
		}
	}

	function handleDateChange() {
		loadedPackagesKey = null;
		loadPackagesForDate();
	}

	function handleClientChange(event: CustomEvent<{ value: unknown }>) {
		selectedClientId = String(event.detail?.value ?? '');
		packages = [];
		selectedPackageId = packageId ? String(packageId) : '';
		loadedPackagesKey = null;
		loadPackagesForDate();
	}

	function validate() {
		errors = {};
		formError = null;

		const parsedCount = Number(count);
		if (!date) errors.date = 'Datum måste anges';
		if (!currentClientId) errors.client = 'Klient måste väljas';
		if (!selectedPackage) errors.package = 'Paket måste väljas';
		if (!Number.isInteger(parsedCount) || parsedCount <= 0) {
			errors.count = 'Antal måste vara minst 1';
		}
		if (parsedCount > 100) {
			errors.count = 'Antal kan högst vara 100';
		}
		if (
			selectedPackage &&
			typeof selectedPackage.remaining_sessions === 'number' &&
			selectedPackage.remaining_sessions < parsedCount
		) {
			formError = 'Det valda paketet har inte tillräckligt saldo.';
		}

		return Object.keys(errors).length === 0 && !formError;
	}

	async function save() {
		if (!validate()) return;

		const targetClientId = toPositiveId(selectedClientId);
		const targetPackageId = toPositiveId(selectedPackageId);
		if (!targetClientId || !targetPackageId) return;

		saving = true;
		try {
			const res = await fetch(`/api/clients/${targetClientId}/saldojustering`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					date,
					count: Number(count),
					package_id: targetPackageId
				})
			});

			const payload = await res.json().catch(() => null);
			if (!res.ok) throw new Error(payload?.error || 'Kunde inte skapa saldojustering.');

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Saldojustering skapades',
				description: `${payload.createdCount ?? Number(count)} pass`
			});
			dispatch('saved', { createdCount: Number(payload.createdCount ?? count) });
		} catch (error: any) {
			formError = error?.message ?? 'Kunde inte skapa saldojustering.';
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte skapa saldojustering',
				description: formError ?? 'Kunde inte skapa saldojustering.'
			});
		} finally {
			saving = false;
		}
	}

	onMount(async () => {
		if (allowClientSelection) {
			await loadClientsForCustomer();
		}
		await loadPackagesForDate();
	});
</script>

<div class="space-y-4">
	{#if formError}
		<div class="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-700">
			{formError}
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		{#if allowClientSelection}
			<Dropdown
				id="client"
				label="Klient"
				placeholder={loadingClients ? 'Hämtar klienter...' : 'Välj klient'}
				options={clientOptions}
				bind:selectedValue={selectedClientId}
				disabled={loadingClients || saving}
				search={clientOptions.length > 5}
				{errors}
				on:change={handleClientChange}
			/>
		{/if}
		<DatePicker
			id="saldo-date"
			name="date"
			label="Datum"
			bind:value={date}
			{errors}
			on:change={handleDateChange}
		/>
		<Dropdown
			id="package"
			label="Paket"
			placeholder={loadingPackages ? 'Hämtar paket...' : 'Välj paket'}
			options={packageOptions}
			bind:selectedValue={selectedPackageId}
			disabled={packageLocked ||
				loadingPackages ||
				saving ||
				!currentClientId ||
				packageOptions.length === 0}
			search={packageOptions.length > 5}
			{errors}
		/>
		<Input
			label="Antal pass"
			name="count"
			type="number"
			min={1}
			max={100}
			bind:value={count}
			{errors}
		/>
	</div>

	<div class="text-sm text-gray-700">
		{#if loadingClients}
			Hämtar klienter…
		{:else if !currentClientId}
			<p>Välj klient för saldojusteringen.</p>
		{:else if loadingPackages}
			Hämtar paket…
		{:else if selectedPackage}
			<p>
				<strong>{selectedPackage.article?.name ?? 'Okänt paket'}</strong>
				<span> - {selectedPackage.customer?.name ?? 'Okänd kund'}</span>
			</p>
			<p>Saldo idag: {formatSaldo(selectedPackage.remaining_sessions_today)}</p>
			<p>Saldo totalt: {formatSaldo(selectedPackage.remaining_sessions)}</p>
		{:else}
			<p>
				{packageLocked
					? 'Det valda paketet kan inte användas för vald klient och datum.'
					: 'Välj ett paket för saldojusteringen.'}
			</p>
		{/if}
	</div>

	<div class="flex justify-end gap-2 pt-2">
		<Button
			text="Skapa saldojustering"
			variant="primary"
			on:click={save}
			disabled={saving || loadingPackages || loadingClients || !currentClientId || !selectedPackage}
		/>
		<Button text="Avbryt" variant="secondary" on:click={closePopup} disabled={saving} />
	</div>
</div>
