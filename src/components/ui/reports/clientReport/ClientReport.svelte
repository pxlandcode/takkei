<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import type { TableType } from '$lib/types/componentTypes';
	import { debounce } from '$lib/utils/debounce';
	import { openPopup } from '$lib/stores/popupStore';
	import Table from '../../../bits/table/Table.svelte';
	import Button from '../../../bits/button/Button.svelte';
	import OptionButton from '../../../bits/optionButton/OptionButton.svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import MailComponent from '../../mailComponent/MailComponent.svelte';

	type ActiveOption = { value: 'all' | 'active' | 'inactive'; label: string };

	type Summary = {
		total: number;
		active: number;
		inactive: number;
		activeWithRecentBooking: number;
		generatedAt: string;
	};

	type CustomerLink = { id: number; name: string };

	type ApiRow = {
		id: number;
		name: string;
		firstname: string;
		lastname: string;
		email: string | null;
		phone: string | null;
		active: boolean;
		primaryTrainerId: number | null;
		primaryTrainerName: string | null;
		totalBookings: number;
		bookingsLast90Days: number;
		bookingsLast30Days: number;
		firstBookingAt: string | null;
		lastBookingAt: string | null;
		nextBookingAt: string | null;
		packageCount: number;
		activePackages: number;
		totalSessions: number;
		usedSessions: number;
		remainingSessions: number;
		totalPackageValue: number;
		customers: CustomerLink[];
		createdAt: string | null;
		updatedAt: string | null;
	};

	type ApiResponse = {
		rows: ApiRow[];
		summary: Summary;
		filteredSummary: Summary;
	};

	type Header = {
		label: string;
		key: string;
		sort?: boolean;
		isSearchable?: boolean;
		width?: string;
	};

	type TableCellItem = {
		type: string;
		label?: string;
		content?: string;
		action?: () => void;
		icon?: string;
		variant?: string;
	};

	type TableRow = { id: number } & Record<
		string,
		string | number | TableCellItem[] | boolean | null
	>;

	const activeOptions: ActiveOption[] = [
		{ value: 'all', label: 'Alla' },
		{ value: 'active', label: 'Aktiva' },
		{ value: 'inactive', label: 'Inaktiva' }
	];
	let activeFilter: ActiveOption = activeOptions[0];

	let headers: Header[] = [
		{ label: 'Namn', key: 'name', sort: true, isSearchable: true },
		{ label: 'Aktiv', key: 'active', sort: true },
		{ label: 'Primär tränare', key: 'primaryTrainer', sort: true, isSearchable: true },
		{ label: 'E-post', key: 'email', isSearchable: true },
		{ label: 'Telefon', key: 'phone', isSearchable: true },
		{ label: 'Tot. bokningar', key: 'totalBookings', sort: true },
		{ label: 'Bokningar 90d', key: 'bookings90', sort: true },
		{ label: 'Bokningar 30d', key: 'bookings30', sort: true },
		{ label: 'Första bokning', key: 'firstBooking', sort: true },
		{ label: 'Senaste bokning', key: 'lastBooking', sort: true },
		{ label: 'Nästa bokning', key: 'nextBooking', sort: true },
		{ label: 'Paket', key: 'packageCount', sort: true },
		{ label: 'Aktiva paket', key: 'activePackages', sort: true },
		{ label: 'Totala pass', key: 'totalSessions', sort: true },
		{ label: 'Använda pass', key: 'usedSessions', sort: true },
		{ label: 'Återstående pass', key: 'remainingSessions', sort: true },
		{ label: 'Paketvärde', key: 'totalPackageValue', sort: true },
		{ label: 'Kunder', key: 'customers', isSearchable: true },
		{ label: 'Skapad', key: 'created', sort: true },
		{ label: 'Uppdaterad', key: 'updated', sort: true }
	];

	const pageSize = 50;
	let page = 0;
	let hasMore = true;
	let loading = false;
	let searchQuery = '';
	let filtersReady = false;
	let summary: Summary | null = null;
	let filteredSummary: Summary | null = null;
	let rows: TableRow[] = [];
	let tableData: TableType = [] as unknown as TableType;
	let sentinel: HTMLDivElement | null = null;
	let observer: IntersectionObserver | null = null;
	let sentinelObserved = false;
	let lastActiveValue: ActiveOption['value'] = activeFilter.value;
	let pendingReset = false;

	function formatDate(value: string | null, includeTime = false) {
		if (!value) return '—';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		try {
			return new Intl.DateTimeFormat('sv-SE', {
				dateStyle: 'short',
				timeStyle: includeTime ? 'short' : undefined
			}).format(date);
		} catch (error) {
			console.error('Failed to format date', error);
			return value;
		}
	}

	function onGoToClient(id: number) {
		goto(`/clients/${id}`);
	}

	function onGoToTrainer(id: number | null) {
		if (!id) return;
		goto(`/users/${id}`);
	}

	function onGoToCustomer(id: number) {
		goto(`/settings/customers/${id}`);
	}

	function openMailPopup(email: string | null) {
		if (!email) return;
		openPopup({
			header: `Maila ${email}`,
			icon: 'Mail',
			component: MailComponent,
			width: '900px',
			props: {
				prefilledRecipients: [email],
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			}
		});
	}

	function mapToTableRow(row: ApiRow): TableRow {
		const displayName = row.name?.trim().length ? row.name : 'Visa klient';
		const nameCell: TableCellItem[] = [
			{
				type: 'link',
				label: displayName,
				action: () => onGoToClient(row.id)
			}
		];

		const trainerCell = row.primaryTrainerId
			? [
					{
						type: 'link',
						label: row.primaryTrainerName ?? 'Visa tränare',
						action: () => onGoToTrainer(row.primaryTrainerId)
					}
				]
			: (row.primaryTrainerName ?? 'Ingen');

		const emailCell = row.email
			? [
					{
						type: 'link',
						label: row.email,
						action: () => openMailPopup(row.email)
					}
				]
			: '—';

		const customersCell = row.customers.length
			? row.customers.map((customer) => ({
					type: 'link',
					label: customer.name,
					action: () => onGoToCustomer(customer.id)
				}))
			: '—';

		return {
			id: row.id,
			name: nameCell,
			active: row.active ? 'Ja' : 'Nej',
			primaryTrainer: trainerCell,
			email: emailCell,
			phone: row.phone ?? '—',
			totalBookings: row.totalBookings,
			bookings90: row.bookingsLast90Days,
			bookings30: row.bookingsLast30Days,
			firstBooking: formatDate(row.firstBookingAt, true),
			lastBooking: formatDate(row.lastBookingAt, true),
			nextBooking: formatDate(row.nextBookingAt, true),
			packageCount: row.packageCount,
			activePackages: row.activePackages,
			totalSessions: row.totalSessions,
			usedSessions: row.usedSessions,
			remainingSessions: row.remainingSessions,
			totalPackageValue: row.totalPackageValue,
			customers: customersCell,
			created: formatDate(row.createdAt, true),
			updated: formatDate(row.updatedAt, true)
		};
	}

	async function fetchReport(reset = false) {
		if (loading) {
			if (reset) pendingReset = true;
			return;
		}

		if (!reset && !hasMore) return;

		loading = true;
		pendingReset = false;

		if (reset) {
			page = 0;
			hasMore = true;
			rows = [];
			tableData = [] as unknown as TableType;
		}

		try {
			const params = new URLSearchParams();
			params.set('active', activeFilter.value);
			params.set('limit', String(pageSize));
			params.set('offset', String(page * pageSize));
			const trimmedSearch = searchQuery.trim();
			if (trimmedSearch) params.set('search', trimmedSearch);
			const res = await fetch(`/api/reports/client-summary?${params.toString()}`);
			if (!res.ok) throw new Error('Kunde inte hämta klientrapporten');
			const json: ApiResponse = await res.json();
			summary = json.summary;
			filteredSummary = json.filteredSummary;
			const mappedRows = json.rows.map(mapToTableRow);
			rows = reset ? mappedRows : [...rows, ...mappedRows];
			tableData = rows as unknown as TableType;
			page += 1;
			hasMore = json.rows.length === pageSize;
		} catch (error) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ladda rapporten',
				description: (error as Error).message
			});
			if (reset) {
				rows = [];
				tableData = [] as unknown as TableType;
				summary = filteredSummary = null;
			}
			hasMore = false;
		} finally {
			loading = false;
			if (pendingReset) {
				pendingReset = false;
				fetchReport(true);
			}
		}
	}

	const debouncedSearch = debounce(() => fetchReport(true), 300);

	onMount(() => {
		filtersReady = true;
		fetchReport(true);

		observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					fetchReport();
				}
			},
			{ rootMargin: '200px 0px', threshold: 0 }
		);

		if (sentinel) {
			observer.observe(sentinel);
			sentinelObserved = true;
		}

		return () => observer?.disconnect();
	});

	$: if (observer && sentinel && !sentinelObserved) {
		observer.observe(sentinel);
		sentinelObserved = true;
	}

	$: if (!sentinel) {
		sentinelObserved = false;
	}

	$: if (filtersReady && activeFilter.value !== lastActiveValue) {
		lastActiveValue = activeFilter.value;
		fetchReport(true);
	}

	async function exportExcel() {
		let success = false;
		try {
			const params = new URLSearchParams({ active: activeFilter.value });
			const trimmedSearch = searchQuery.trim();
			if (trimmedSearch) params.set('search', trimmedSearch);
			const res = await fetch(`/api/reports/client-summary/export?${params.toString()}`);
			if (!res.ok) throw new Error('Kunde inte skapa Excel');
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `klientrapport_${activeFilter.value}.xlsx`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
			success = true;
		} catch (error) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Export misslyckades',
				description: (error as Error).message
			});
		} finally {
			if (success) {
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Export slutförd',
					description: 'Excel-filen har skapats.'
				});
			}
		}
	}
</script>

<div class="custom-scrollbar m-4 h-full overflow-x-auto">
	<div class="mb-4 flex items-center gap-2">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Person" size="14px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">Klientrapport</h2>
	</div>

	<div class="mb-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
		<div class="flex flex-col gap-3">
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="flex flex-col gap-1">
					<span class="text-text/70 text-sm">Status</span>
					<OptionButton
						options={activeOptions}
						bind:selectedOption={activeFilter}
						size="small"
						full
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-text/70 text-sm">Sök</span>
					<input
						type="text"
						bind:value={searchQuery}
						on:input={debouncedSearch}
						placeholder="Sök namn, e-post, tränare, kund..."
						class="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
					/>
				</label>
			</div>
		</div>
		<div class="flex justify-end">
			<Button
				text="Exportera"
				variant="primary"
				iconLeft="Download"
				iconColor="white"
				iconSize="12px"
				on:click={exportExcel}
			/>
		</div>
	</div>

	{#if filteredSummary}
		<div class="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Visade klienter</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.total}</p>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Aktiva (visade)</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.active}</p>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Inaktiva (visade)</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.inactive}</p>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Aktiva med bokning (90 d)</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.activeWithRecentBooking}</p>
			</div>
		</div>
	{/if}

	{#if summary}
		<p class="text-text/60 mb-4 text-sm">
			Totalt i databasen: <strong>{summary.total}</strong> klienter (aktiva: {summary.active},
			inaktiva:
			{summary.inactive}). Uppdaterad {formatDate(summary.generatedAt, true)}.
		</p>
	{/if}

	{#if rows.length === 0 && loading}
		<div class="text-text/60 py-10">Laddar rapport…</div>
	{:else if rows.length === 0}
		<div class="text-text/60 py-10">Inga resultat att visa.</div>
	{:else}
		<Table {headers} data={tableData} noSelect sideScrollable />
	{/if}

	{#if rows.length > 0}
		<div bind:this={sentinel} class="h-1 w-full"></div>
	{/if}

	{#if loading && rows.length > 0}
		<p class="text-text/60 py-4 text-center text-sm">Laddar fler rader…</p>
	{/if}

	{#if !hasMore && rows.length > 0 && !loading}
		<p class="text-text/60 py-4 text-center text-sm">Inga fler rader att visa.</p>
	{/if}
</div>
