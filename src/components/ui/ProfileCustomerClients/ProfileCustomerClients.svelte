<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import DropdownCheckbox from '../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import FilterBox from '../../bits/filterBox/FilterBox.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	type RawClient = { id: number | string; firstname?: string; lastname?: string };

	interface ClientOption {
		id: number;
		firstname: string;
		lastname: string;
	}

	export let customerId: number;
	export let clients: RawClient[] = [];

	const dispatch = createEventDispatcher<{ clientsUpdated: ClientOption[] }>();

	const collator = new Intl.Collator('sv', { sensitivity: 'base' });

	let clientCache: Map<number, ClientOption> = new Map<number, ClientOption>();
	let allClients: ClientOption[] = [];
	let selectedClients: ClientOption[] = [];
	let clientsLoading = false;
	let clientLoadError = '';
	let isSavingClients = false;

	function getClientLabel(client: ClientOption): string {
		const parts = [client.firstname, client.lastname].filter(Boolean);
		return parts.length ? parts.join(' ') : 'Namnlös klient';
	}

	function refreshAllClients() {
		allClients = Array.from(clientCache.values()).sort((a, b) => {
			const lastCompare = collator.compare(a.lastname, b.lastname);
			if (lastCompare !== 0) return lastCompare;
			return collator.compare(a.firstname, b.firstname);
		});
	}

	function toClientOption(raw: RawClient | undefined | null): ClientOption | null {
		if (!raw) return null;
		const id = Number(raw.id);
		if (!Number.isFinite(id) || id <= 0) return null;

		const firstname = typeof raw.firstname === 'string' ? raw.firstname.trim() : '';
		const lastname = typeof raw.lastname === 'string' ? raw.lastname.trim() : '';

		const existing = clientCache.get(id);
		if (existing) {
			existing.firstname = firstname;
			existing.lastname = lastname;
			return existing;
		}

		const client: ClientOption = { id, firstname, lastname };
		clientCache.set(id, client);
		return client;
	}

	function syncSelectedClients(source: RawClient[]) {
		const nextSelected: ClientOption[] = [];
		for (const raw of source) {
			const client = toClientOption(raw);
			if (client) nextSelected.push(client);
		}

		selectedClients = nextSelected;
		refreshAllClients();
	}

	let lastPropClientIds = '';
	$: {
		const propIds = Array.isArray(clients)
			? [...new Set(clients.map((client) => Number(client?.id)).filter((id) => Number.isFinite(id)))].sort((a, b) => a - b)
			: [];
		const key = JSON.stringify(propIds);
		if (key !== lastPropClientIds) {
			lastPropClientIds = key;
			syncSelectedClients(clients ?? []);
		}
	}

	async function loadAllClients() {
		clientsLoading = true;
		clientLoadError = '';
		try {
			const res = await fetch('/api/clients?short=true&limit=5000');
			if (!res.ok) {
				clientLoadError = 'Kunde inte hämta klienter.';
				return;
			}

			const rows = await res.json();
			if (Array.isArray(rows)) {
				for (const raw of rows) {
					toClientOption(raw);
				}
			}
		} catch (error) {
			console.error('Error loading clients list:', error);
			clientLoadError = 'Det gick inte att hämta klienter.';
		} finally {
			refreshAllClients();
			// Ensure selected clients reference cached instances
			selectedClients = selectedClients
				.map((client) => clientCache.get(client.id))
				.filter(Boolean) as ClientOption[];
			clientsLoading = false;
		}
	}

	onMount(() => {
		if (!customerId) return;
		loadAllClients();
	});

	function handleClientSelection(event: CustomEvent<{ selected: ClientOption[] }>) {
		selectedClients = [...event.detail.selected];
	}

	function removeClient(id: number) {
		selectedClients = selectedClients.filter((client) => client.id !== id);
	}

	async function handleSaveClients() {
		if (!customerId || isSavingClients) return;
		isSavingClients = true;
		try {
			const payload = {
				clientIds: selectedClients.map((client) => client.id)
			};

			const res = await fetch(`/api/customers/${customerId}/clients`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const result = await res.json();

			if (!res.ok) {
				const description = result?.error || 'Kunde inte uppdatera klientkopplingar.';
				addToast({
					type: AppToastType.CANCEL,
					message: 'Fel vid uppdatering',
					description
				});
				return;
			}

			const updatedClientsRaw = Array.isArray(result.clients) ? result.clients : [];
			const normalizedClients: ClientOption[] = [];
			for (const raw of updatedClientsRaw) {
				const client = toClientOption(raw);
				if (client) normalizedClients.push(client);
			}

			refreshAllClients();
			selectedClients = normalizedClients
				.map((client) => clientCache.get(client.id))
				.filter(Boolean) as ClientOption[];

			dispatch('clientsUpdated', normalizedClients.map((client) => ({ ...client })));

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Klientkopplingar uppdaterade',
				description: 'Kundens klienter har uppdaterats.'
			});
		} catch (error) {
			console.error('Failed to update clients for customer:', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid uppdatering',
				description: 'Något gick fel när klientkopplingarna skulle sparas.'
			});
		} finally {
			isSavingClients = false;
		}
	}
</script>

<div class="rounded-lg bg-white p-6 shadow-md">
	<div class="flex flex-col gap-4">
		<div>
			<h3 class="text-xl font-semibold text-text">Klientkopplingar</h3>
			<p class="text-sm text-gray-500">Koppla en eller flera klienter till kunden.</p>
		</div>

		<DropdownCheckbox
			label="Välj klienter"
			id={`customer-clients-${customerId}`}
			placeholder={clientsLoading && allClients.length === 0 ? 'Hämtar klienter...' : 'Välj klienter'}
			options={allClients.map((client) => ({ name: getClientLabel(client), value: client }))}
			bind:selectedValues={selectedClients}
			on:change={handleClientSelection}
			disabled={clientsLoading && allClients.length === 0}
			search
			infiniteScroll
		/>

		{#if clientLoadError}
			<p class="text-sm text-red-500">{clientLoadError}</p>
		{/if}

		{#if selectedClients.length > 0}
			<FilterBox title="Valda klienter" {selectedClients} on:removeFilter={(event) => removeClient(event.detail.id)} />
		{/if}

		<div class="flex justify-end">
			<Button
				text={isSavingClients ? 'Sparar...' : 'Spara kopplingar'}
				variant="primary"
				iconLeft="Check"
				iconLeftSize="14px"
				on:click={handleSaveClients}
				disabled={isSavingClients || clientsLoading}
			/>
		</div>
	</div>
</div>
