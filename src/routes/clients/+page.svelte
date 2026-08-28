<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { user } from '$lib/stores/userStore';
	import { browser } from '$app/environment';
	import type { TableCellArrayItem, TableType } from '$lib/types/componentTypes';
	import Table from '../../components/bits/table/Table.svelte';
	import { goto } from '$app/navigation';
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import OptionButton from '../../components/bits/optionButton/OptionButton.svelte';
	import ClientForm from '../../components/ui/clientForm/ClientForm.svelte';
	import BookingPopup from '../../components/ui/bookingPopup/BookingPopup.svelte';
	import { calendarStore } from '$lib/stores/calendarStore';
	import type { CalendarFilters } from '$lib/stores/calendarStore';
	import { getCalendarUrl } from '$lib/helpers/calendarHelpers/calendarNavigation';
	import MailComponent from '../../components/ui/mailComponent/MailComponent.svelte';
	import { debounce } from '$lib/utils/debounce';
	import { openPopup } from '$lib/stores/popupStore';
	import { headerState } from '$lib/stores/headerState.svelte';
	import { getCachedJson, invalidateByPrefix, wrapFetch } from '$lib/services/api/apiCache';
	import { page as pageStore } from '$app/stores';
	import { isAdministrator, signupOnboardingStore } from '$lib/stores/signupOnboardingStore';
	import SignupOnboardingQueue from '../../components/ui/signupOnboarding/SignupOnboardingQueue.svelte';

	// Headers (sortable like customers: name + trainer)
	const headers = [
		{ label: 'Klient', key: 'name', icon: 'Person', sort: true, isSearchable: true },
		{ label: 'Kontakt', key: 'contact', isSearchable: true },
		{ label: 'Primär tränare', key: 'trainer', sort: true, isSearchable: true },
		{ label: 'Actions', key: 'actions', isSearchable: false, width: '161px' }
	];

	// Filters
	let selectedStatusOption: { value: 'active' | 'inactive' | 'all'; label: string } = {
		value: 'active',
		label: 'Visa aktiva'
	};
	let selectedOwnershipOption: {
		value: 'mine' | 'all' | 'new';
		label: string;
		notificationCount?: number;
	} = { value: 'mine', label: 'Mina klienter' };
	let searchQuery = '';
	const debouncedSearch = debounce(() => {
		if (selectedOwnershipOption.value !== 'new') fetchPaginatedClients(true);
	}, 300);
	$: currentUser = $user;
	$: canManageOnboarding = isAdministrator(currentUser);
	$: ownershipOptions = [
		{ value: 'mine' as const, label: 'Mina klienter' },
		{ value: 'all' as const, label: 'Alla klienter' },
		...(canManageOnboarding
			? [
					{
						value: 'new' as const,
						label: 'Nya klienter',
						notificationCount: $signupOnboardingStore.pending
					}
				]
			: [])
	];
	$: requestedOwnershipView = $pageStore.url.searchParams.get('view');
	$: if (browser) {
		const nextView =
			requestedOwnershipView === 'new' && canManageOnboarding
				? 'new'
				: requestedOwnershipView === 'all'
					? 'all'
					: 'mine';
		if (selectedOwnershipOption.value !== nextView) {
			selectedOwnershipOption = {
				value: nextView,
				label:
					nextView === 'new'
						? 'Nya klienter'
						: nextView === 'all'
							? 'Alla klienter'
							: 'Mina klienter'
			};
		}
	}

	// Paging/load state
	let data: TableType = [];
	let filteredData: TableType = [];
	let page = 0;
	let limit = 50;
	let isLoading = false;
	let isFetching = false;
	let hasMore = true;
	let sortBy: 'name' | 'email' | 'trainer' = 'name';
	let sortOrder: 'asc' | 'desc' = 'asc';

	function onGoToClient(id: number) {
		goto(`/clients/${id}`);
	}

	function onGoToClientsCalendar(clientId: number) {
		const filters: Partial<CalendarFilters> = { clientIds: [clientId] };
		calendarStore.setNewFilters(filters, fetch);
		goto(getCalendarUrl(filters));
	}

	function onBookClient(clientId: number) {
		openBookingPopup(clientId);
	}

	function onSendClientEmail(email: string) {
		if (!email) return;
		openMailPopup(email);
	}

	function openClientForm() {
		openPopup({
			header: 'Ny klient',
			icon: 'Plus',
			component: ClientForm as any,
			maxWidth: '650px',
			listeners: {
				created: () => {
					fetchPaginatedClients(true, { force: true });
				}
			},
			closeOn: ['created']
		});
	}

	function openBookingPopup(clientId: number | null) {
		openPopup({
			header: 'Bokning',
			icon: 'Plus',
			component: BookingPopup,
			props: { clientId },
			maxWidth: '650px'
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
			}
		});
	}

	function buildQueryParams(pageIndex = page) {
		const currentUser = get(user);
		const params = new URLSearchParams();

		// paging
		params.set('limit', String(limit));
		params.set('offset', String(pageIndex * limit));

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

	function mapClientRows(fetched: any[]): TableType {
		return fetched.map((client) => {
			const contact: TableCellArrayItem[] = [];
			if (client.email) {
				contact.push({
					type: 'link',
					label: client.email,
					action: () => onSendClientEmail(client.email)
				});
			}
			if (client.phone) {
				contact.push({ type: 'phone', content: client.phone });
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
	}

	function applyClientRows(fetched: any[], reset: boolean, pageIndex: number) {
		const newData = mapClientRows(fetched);
		data = reset ? newData : [...data, ...newData];
		hasMore = newData.length >= limit;
		page = pageIndex + 1;
	}

	async function fetchPaginatedClients(reset = false, options: { force?: boolean } = {}) {
		if (!browser || selectedOwnershipOption.value === 'new') return;
		if (isFetching || (!hasMore && !reset)) return;

		const cachedFetch = wrapFetch(fetch);
		const pageIndex = reset ? 0 : page;
		const qs = buildQueryParams(pageIndex);
		const url = `/api/clients?${qs}`;

		if (options.force) {
			invalidateByPrefix('/api/clients');
		}

		if (reset) {
			page = 0;
			hasMore = true;
			const cached = options.force ? null : getCachedJson<any[]>(url);
			if (cached) {
				applyClientRows(cached, true, pageIndex);
			} else {
				data = [];
			}
		}

		isFetching = true;
		isLoading = !(reset && data.length > 0);

		try {
			const res = await cachedFetch(url);
			if (!res.ok) throw new Error('Failed to fetch clients');

			const fetched = await res.json();
			applyClientRows(fetched, reset, pageIndex);
		} catch (e) {
			console.error('Error loading clients:', e);
		} finally {
			isFetching = false;
			isLoading = false;
		}
	}

	function handleScroll(event: Event) {
		const el = event.target as HTMLElement;
		if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
			fetchPaginatedClients();
		}
	}

	async function handleSortChange(event: CustomEvent<{ column: string; order: 'asc' | 'desc' }>) {
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
		headerState.title = 'Klienter';
		headerState.icon = 'Person';
		signupOnboardingStore.start(get(user));
		const requestedView = $pageStore.url.searchParams.get('view');
		if (requestedView === 'new' && canManageOnboarding) {
			selectedOwnershipOption = { value: 'new', label: 'Nya klienter' };
		} else if (requestedView === 'all') {
			selectedOwnershipOption = { value: 'all', label: 'Alla klienter' };
		} else {
			selectedOwnershipOption = { value: 'mine', label: 'Mina klienter' };
		}
		if (requestedView === 'new' && !canManageOnboarding) {
			void goto('/clients?view=mine', { replaceState: true, keepFocus: true, noScroll: true });
		}
		if (selectedOwnershipOption.value !== 'new') fetchPaginatedClients(true);
	});

	function handleOwnershipSelect(event: CustomEvent<'mine' | 'all' | 'new'>) {
		const view = event.detail;
		if (view === 'new' && !canManageOnboarding) return;
		searchQuery = '';
		void goto(`/clients?view=${view}`, { replaceState: true, keepFocus: true, noScroll: true });
		if (view !== 'new') void fetchPaginatedClients(true);
	}

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
	$: if (
		browser &&
		selectedStatusOption.value &&
		selectedOwnershipOption.value &&
		selectedOwnershipOption.value !== 'new'
	) {
		fetchPaginatedClients(true);
	}
</script>

<div class="custom-scrollbar m-4 h-full overflow-x-scroll" on:scroll={handleScroll}>
	<!-- Page Title -->
	<div class="hidden items-center gap-2 md:flex">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Person" size="14px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">Klienter</h2>
	</div>

	<!-- Filters -->
	<div class="my-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div>
			<Button text="Lägg till klient" variant="primary" on:click={openClientForm} />
		</div>

		<div
			class="flex flex-col gap-2 min-[1430px]:flex-row min-[1430px]:items-center min-[1430px]:gap-4"
		>
			<input
				type="text"
				bind:value={searchQuery}
				on:input={debouncedSearch}
				placeholder="Sök klient..."
				class="w-full max-w-md min-w-60 rounded-sm border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
			/>

			<div
				class={canManageOnboarding
					? 'w-full min-w-0 min-[1430px]:w-auto min-[1430px]:min-w-[340px]'
					: 'min-w-60'}
			>
				<OptionButton
					options={ownershipOptions}
					bind:selectedOption={selectedOwnershipOption}
					size="small"
					on:select={handleOwnershipSelect}
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

	{#if selectedOwnershipOption.value === 'new'}
		<SignupOnboardingQueue search={searchQuery} status={selectedStatusOption.value} />
	{:else}
		<Table {headers} data={filteredData} noSelect on:sortChange={handleSortChange} />
	{/if}

	{#if selectedOwnershipOption.value !== 'new' && isLoading}
		<p class="my-4 text-center text-sm text-gray-400">Laddar fler klienter...</p>
	{/if}

	{#if selectedOwnershipOption.value !== 'new' && !hasMore && data.length > 0}
		<p class="my-4 text-center text-sm text-gray-400">Inga fler klienter att visa.</p>
	{/if}
</div>

<!-- Popups handled via global store -->
