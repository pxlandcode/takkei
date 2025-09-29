<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { user } from '$lib/stores/userStore';
	import type { TableType } from '$lib/types/componentTypes';
	import Table from '../../components/bits/table/Table.svelte';
	import { goto } from '$app/navigation';
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import OptionButton from '../../components/bits/optionButton/OptionButton.svelte';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import ClientForm from '../../components/ui/clientForm/ClientForm.svelte';
	import PopupWrapper from '../../components/ui/popupWrapper/PopupWrapper.svelte';
	import BookingPopup from '../../components/ui/bookingPopup/BookingPopup.svelte';
	import { calendarStore } from '$lib/stores/calendarStore';
	import MailComponent from '../../components/ui/mailComponent/MailComponent.svelte';
	import { debounce } from '$lib/utils/debounce';

	// State for popups
	let showClientModal = false;
	let showBookingPopup = false;
	let selectedClientsId: number | null = null;
	let selectedClientEmail: string | null = null;
	let showMailPopup = false;

	function openClientForm() {
		showClientModal = true;
	}
	function closeClientForm() {
		showClientModal = false;
	}

	// Headers (sortable like customers: name + trainer)
	const headers = [
		{ label: 'Klient', key: 'name', icon: 'Person', sort: true, isSearchable: true },
		{ label: 'Kontakt', key: 'contact', isSearchable: true },
		{ label: 'Primär tränare', key: 'trainer', sort: true, isSearchable: true },
		{ label: 'Actions', key: 'actions', isSearchable: false, width: '161px' }
	];

	// Filters
	let selectedStatusOption = { value: 'active', label: 'Visa aktiva' }; // active | inactive | all
	let selectedOwnershipOption = { value: 'mine', label: 'Mina klienter' }; // mine | all
	let searchQuery = '';
	const debouncedSearch = debounce(() => fetchPaginatedClients(true), 300);

	// Paging/load state
	let data: TableType = [];
	let filteredData: TableType = [];
	let page = 0;
	let limit = 50;
	let isLoading = false;
	let hasMore = true;
	let sortBy: 'name' | 'email' | 'trainer' = 'name';
	let sortOrder: 'asc' | 'desc' = 'asc';

	$: isAdmin = hasRole('Administrator');

	function onGoToClient(id: number) {
		goto(`/clients/${id}`);
	}

	function onGoToClientsCalendar(clientId: number) {
		calendarStore.setNewFilters({ clientIds: [clientId] }, fetch);
		goto(`/calendar?clientIds=${clientId}`);
	}

	function onBookClient(clientId: number) {
		selectedClientsId = clientId;
		showBookingPopup = true;
	}

	function onSendClientEmail(email: string) {
		if (!email) return;
		selectedClientEmail = email;
		showMailPopup = true;
	}

	function buildQueryParams() {
		const currentUser = get(user);
		const params = new URLSearchParams();

		// paging
		params.set('limit', String(limit));
		params.set('offset', String(page * limit));

		// sort
		params.set('sortBy', sortBy);
		params.set('sortOrder', sortOrder);

		// search
		if (searchQuery?.trim()) params.set('search', searchQuery.trim());

		// status
		if (selectedStatusOption.value === 'active') params.set('active', 'true');
		else if (selectedStatusOption.value === 'inactive') params.set('active', 'false');

		// ownership (mine -> trainerId=currentUser.id)
		if (selectedOwnershipOption.value === 'mine' && currentUser?.id) {
			params.set('trainerId', String(currentUser.id));
		}

		return params.toString();
	}

	async function fetchPaginatedClients(reset = false) {
		if (isLoading || (!hasMore && !reset)) return;

		isLoading = true;

		if (reset) {
			page = 0;
			data = [];
			hasMore = true;
		}

		try {
			const qs = buildQueryParams();
			const res = await fetch(`/api/clients?${qs}`);
			if (!res.ok) throw new Error('Failed to fetch clients');

			const fetched = await res.json();

			const newData: TableType = fetched.map((client) => ({
				id: client.id,
				name: [
					{
						type: 'link',
						label: `${client.firstname ?? ''} ${client.lastname ?? ''}`.trim(),
						action: () => onGoToClient(client.id)
					}
				],
				contact: [
					client.email
						? { type: 'link', label: client.email, action: () => onSendClientEmail(client.email) }
						: null,
					client.phone ? { type: 'phone', content: client.phone } : null
				].filter(Boolean),
				trainer:
					client.trainer_firstname || client.trainer_lastname
						? `${client.trainer_firstname ?? ''} ${client.trainer_lastname ?? ''}`.trim()
						: 'Ingen',
				trainerId: client.trainer_id ?? client.primary_trainer_id ?? null,
				isActive: client.active,
				actions: [
					{
						type: 'button',
						label: 'Boka',
						icon: 'Plus',
						variant: 'primary',
						action: () => onBookClient(client.id)
					},
					{
						type: 'button',
						label: '',
						icon: 'Calendar',
						variant: 'secondary',
						action: () => onGoToClientsCalendar(client.id)
					}
				]
			}));

			data = [...data, ...newData];

			if (newData.length < limit) hasMore = false;
			page++;
		} catch (e) {
			console.error('Error loading clients:', e);
		} finally {
			isLoading = false;
		}
	}

	function handleScroll(event: Event) {
		const el = event.target as HTMLElement;
		if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
			fetchPaginatedClients();
		}
	}

	async function handleSortChange(event) {
		const { column, order } = event.detail; // emitted by <Table/>
		// Map table column -> API sort key
		if (column === 'name') sortBy = 'name';
		else if (column === 'trainer') sortBy = 'trainer';
		else if (column === 'contact') sortBy = 'email';
		else sortBy = 'name';

		sortOrder = order; // 'asc' | 'desc'
		await fetchPaginatedClients(true);
	}

	// Initial load
	onMount(() => {
		fetchPaginatedClients(true);
	});

	// Local filtering (status, quick text match while server search runs)
	$: {
		const query = searchQuery.toLowerCase().trim();

		filteredData = data.filter((row) => {
			// status
			if (selectedStatusOption.value === 'active' && !row.isActive) return false;
			if (selectedStatusOption.value === 'inactive' && row.isActive) return false;

			if (!query) return true;

			// local quick match (label + content)
			return headers.some((header) => {
				const value = row[header.key];
				if (header.isSearchable && typeof value === 'string') {
					return value.toLowerCase().includes(query);
				}
				if (Array.isArray(value)) {
					return value.some((item) => {
						const s = (item?.content ?? item?.label ?? '').toString().toLowerCase();
						return s.includes(query);
					});
				}
				return false;
			});
		});
	}

	// Reload from server when filters change
	$: selectedStatusOption, selectedOwnershipOption, fetchPaginatedClients(true);
</script>

<div class="m-4 h-full overflow-x-scroll custom-scrollbar" on:scroll={handleScroll}>
	<!-- Page Title -->
	<div class="flex items-center gap-2">
		<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Person" size="14px" />
		</div>
		<h2 class="text-3xl font-semibold text-text">Klienter</h2>
	</div>

	<!-- Filters -->
	<div class="my-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			{#if isAdmin}
				<Button text="Lägg till klient" variant="primary" on:click={openClientForm} />
			{/if}
		</div>

		<div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-4">
			<input
				type="text"
				bind:value={searchQuery}
				on:input={debouncedSearch}
				placeholder="Sök klient..."
				class="w-full min-w-60 max-w-md rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
			/>

			<div class="min-w-60">
				<OptionButton
					options={[
						{ value: 'mine', label: 'Mina klienter' },
						{ value: 'all', label: 'Alla klienter' }
					]}
					bind:selectedOption={selectedOwnershipOption}
					size="small"
				/>
			</div>
			<div class="min-w-80">
				<OptionButton
					options={[
						{ value: 'active', label: 'Visa aktiva' },
						{ value: 'inactive', label: 'Visa inaktiva' },
						{ value: 'all', label: 'Visa alla' }
					]}
					bind:selectedOption={selectedStatusOption}
					size="small"
				/>
			</div>
		</div>
	</div>

	<Table {headers} data={filteredData} noSelect on:sortChange={handleSortChange} />

	{#if isLoading}
		<p class="my-4 text-center text-sm text-gray-400">Laddar fler klienter...</p>
	{/if}

	{#if !hasMore && data.length > 0}
		<p class="my-4 text-center text-sm text-gray-400">Inga fler klienter att visa.</p>
	{/if}
</div>

<!-- Modals -->
{#if showClientModal}
	<PopupWrapper header="Ny klient" icon="Plus" on:close={closeClientForm}>
		<ClientForm
			on:created={() => {
				closeClientForm();
				fetchPaginatedClients(true); // refresh list after creating a client
			}}
		/>
	</PopupWrapper>
{/if}

{#if showBookingPopup}
	<PopupWrapper
		header="Bokning"
		icon="Plus"
		on:close={() => ((showBookingPopup = false), (selectedClientsId = null))}
	>
		<BookingPopup
			on:close={() => ((showBookingPopup = false), (selectedClientsId = null))}
			clientId={selectedClientsId}
		/>
	</PopupWrapper>
{/if}

{#if showMailPopup && selectedClientEmail}
	<PopupWrapper
		width="900px"
		header="Maila {selectedClientEmail}"
		icon="Mail"
		on:close={() => ((showMailPopup = false), (selectedClientEmail = null))}
	>
		<MailComponent
			prefilledRecipients={[selectedClientEmail]}
			lockedFields={['recipients']}
			autoFetchUsersAndClients={false}
		/>
	</PopupWrapper>
{/if}
