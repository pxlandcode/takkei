<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import type { TableType } from '$lib/types/componentTypes';
	import Table from '../../bits/table/Table.svelte';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import BookingPopup from '../bookingPopup/BookingPopup.svelte';
	import { calendarStore } from '$lib/stores/calendarStore';
	import type { CalendarFilters } from '$lib/stores/calendarStore';
	import { getCalendarUrl } from '$lib/helpers/calendarHelpers/calendarNavigation';
	import MailComponent from '../mailComponent/MailComponent.svelte';
	import { debounce } from '$lib/utils/debounce';
	import { openPopup } from '$lib/stores/popupStore';
	import { wrapFetch } from '$lib/services/api/apiCache';

	export let trainerId: number;

	type SortKey = 'name' | 'email' | 'trainer';
	type SortOrder = 'asc' | 'desc';
	type TrainerClientRow = {
		id: number;
		firstname?: string | null;
		lastname?: string | null;
		email?: string | null;
		phone?: string | null;
		trainer_id?: number | null;
		primary_trainer_id?: number | null;
		trainer_firstname?: string | null;
		trainer_lastname?: string | null;
		active?: boolean | null;
	};

	const headers = [
		{ label: 'Klient', key: 'name', icon: 'Person', sort: true, isSearchable: true },
		{ label: 'Kontakt', key: 'contact', isSearchable: true },
		{ label: 'Primär tränare', key: 'trainer', sort: true, isSearchable: true },
		{ label: 'Actions', key: 'actions', isSearchable: false, width: '161px' }
	];

	let selectedClientId: number | null = null;
	let selectedClientEmail: string | null = null;
	let selectedStatusOption = { value: 'active', label: 'Visa aktiva' };
	let searchQuery = '';
	const debouncedSearch = debounce(() => fetchPaginatedClients(true), 300);

	let data: TableType = [];
	let filteredData: TableType = [];
	let page = 0;
	let limit = 50;
	let isLoading = false;
	let hasMore = true;
	let sortBy: SortKey = 'name';
	let sortOrder: SortOrder = 'asc';

	function onGoToClient(id: number) {
		goto(`/clients/${id}`);
	}

	function onGoToClientsCalendar(clientId: number) {
		const filters: Partial<CalendarFilters> = { clientIds: [clientId] };
		calendarStore.setNewFilters(filters, fetch);
		goto(getCalendarUrl(filters));
	}

	function onBookClient(clientId: number) {
		selectedClientId = clientId;
		openBookingPopup(clientId);
	}

	function onSendClientEmail(email: string) {
		if (!email) return;
		selectedClientEmail = email;
		openMailPopup(email);
	}

	function openBookingPopup(clientId: number | null) {
		openPopup({
			header: 'Bokning',
			icon: 'Plus',
			component: BookingPopup,
			props: { clientId },
			maxWidth: '650px',
			listeners: {
				close: () => {
					selectedClientId = null;
				}
			}
		});
	}

	function openMailPopup(email: string) {
		openPopup({
			header: `Maila ${email}`,
			icon: 'Mail',
			component: MailComponent,
			maxWidth: '900px',
			props: {
				prefilledRecipients: [email],
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			},
			listeners: {
				close: () => {
					selectedClientEmail = null;
				}
			}
		});
	}

	function buildQueryParams() {
		const params = new URLSearchParams();

		params.set('limit', String(limit));
		params.set('offset', String(page * limit));
		params.set('sortBy', sortBy);
		params.set('sortOrder', sortOrder);
		params.set('trainerId', String(trainerId));

		if (searchQuery?.trim()) params.set('search', searchQuery.trim());
		if (selectedStatusOption.value === 'active') params.set('active', 'true');
		else if (selectedStatusOption.value === 'inactive') params.set('active', 'false');

		return params.toString();
	}

	async function fetchPaginatedClients(reset = false) {
		if (!browser || !trainerId) return;
		if (isLoading || (!hasMore && !reset)) return;

		const cachedFetch = wrapFetch(fetch);
		isLoading = true;

		if (reset) {
			page = 0;
			data = [];
			hasMore = true;
		}

		try {
			const qs = buildQueryParams();
			const res = await cachedFetch(`/api/clients?${qs}`);
			if (!res.ok) throw new Error('Failed to fetch clients');

			const fetched: TrainerClientRow[] = await res.json();

			const newData: TableType = fetched.map((client: TrainerClientRow) => {
				const clientEmail = client.email?.trim() ?? '';
				const clientPhone = client.phone?.trim() ?? '';
				const contact = [];

				if (clientEmail) {
					contact.push({
						type: 'link',
						label: clientEmail,
						action: () => onSendClientEmail(clientEmail)
					});
				}

				if (clientPhone) {
					contact.push({ type: 'phone', content: clientPhone });
				}

				return {
					id: client.id,
					name: [
						{
							type: 'link',
							label: `${client.firstname ?? ''} ${client.lastname ?? ''}`.trim(),
							action: () => onGoToClient(client.id)
						}
					],
					contact,
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
				};
			});

			data = [...data, ...newData];

			if (newData.length < limit) hasMore = false;
			page++;
		} catch (error) {
			console.error('Error loading trainer clients:', error);
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

	async function handleSortChange(event: CustomEvent<{ column: string; order: SortOrder }>) {
		const { column, order } = event.detail;
		if (column === 'name') sortBy = 'name';
		else if (column === 'trainer') sortBy = 'trainer';
		else if (column === 'contact') sortBy = 'email';
		else sortBy = 'name';

		sortOrder = order;
		await fetchPaginatedClients(true);
	}

	$: {
		const query = searchQuery.toLowerCase().trim();
		filteredData = data.filter((row) => {
			if (selectedStatusOption.value === 'active' && !row.isActive) return false;
			if (selectedStatusOption.value === 'inactive' && row.isActive) return false;
			if (!query) return true;

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

	$: if (browser && trainerId) {
		trainerId;
		selectedStatusOption;
		fetchPaginatedClients(true);
	}
</script>

<div
	class="custom-scrollbar h-full min-h-0 overflow-y-auto overflow-x-auto pb-4"
	on:scroll={handleScroll}
>
	<div class="my-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between xl:gap-4">
		<input
			type="text"
			bind:value={searchQuery}
			on:input={debouncedSearch}
			placeholder="Sök klient..."
			class="w-full max-w-md min-w-60 rounded-sm border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
		/>

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

	<Table {headers} data={filteredData} noSelect on:sortChange={handleSortChange} />

	{#if isLoading}
		<p class="my-4 text-center text-sm text-gray-400">Laddar fler klienter...</p>
	{/if}

	{#if !isLoading && filteredData.length === 0}
		<p class="my-4 text-center text-sm text-gray-400">Inga klienter hittades.</p>
	{/if}

	{#if !hasMore && data.length > 0}
		<p class="my-4 text-center text-sm text-gray-400">Inga fler klienter att visa.</p>
	{/if}
</div>
