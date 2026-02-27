<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import type { TableType } from '$lib/types/componentTypes';
	import { debounce } from '$lib/utils/debounce';
	import Table from '../../../bits/table/Table.svelte';
	import Button from '../../../bits/button/Button.svelte';
	import OptionButton from '../../../bits/optionButton/OptionButton.svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import Input from '../../../bits/Input/Input.svelte';

	type PriorityValue = 'attention' | 'urgent' | 'watch' | 'ok' | 'all';
	type CapacityValue = 'all' | 'full' | 'near_full' | 'open';
	type ClientValue = 'all' | 'active' | 'inactive';
	type FrozenValue = 'exclude_frozen' | 'all' | 'only_frozen';
	type Option = { id: number; label: string };
	type DropdownOption = { value: string; label: string };

	type Summary = {
		total: number;
		urgent: number;
		watch: number;
		ok: number;
		fullBooked: number;
		nearFull: number;
		frozen: number;
		activeClient: number;
		inactiveClient: number;
		withoutClient: number;
		avgRemainingByBooked: number;
		avgRemainingByPassed: number;
		generatedAt: string;
	};

	type ApiRow = {
		packageId: number;
		clientId: number | null;
		customerId: number | null;
		articleId: number | null;
		articleName: string | null;
		totalSessions: number;
		bookedTotal: number;
		bookedPassed: number;
		bookedFuture: number;
		remainingByBooked: number;
		remainingByPassed: number;
		firstBookingAt: string | null;
		lastBookingAt: string | null;
		lastPassedBookingAt: string | null;
		nextBookingAt: string | null;
		daysToLastBooking: number | null;
		isFullBooked: boolean;
		isNearFull: boolean;
		isFrozen: boolean;
		priority: 'urgent' | 'watch' | 'ok';
		priorityLabel: string;
		urgencyReason: string;
		clientName: string | null;
		clientActive: boolean | null;
		customerName: string | null;
		customerNo: string | null;
		primaryTrainerId: number | null;
		primaryTrainerName: string | null;
		primaryLocationId: number | null;
		primaryLocationName: string | null;
		paidPrice: number | null;
		firstPaymentDate: string | null;
		frozenFromDate: string | null;
		autogiro: boolean;
		createdAt: string | null;
	};

	type ApiResponse = {
		rows: ApiRow[];
		summary: Summary;
		filteredSummary: Summary;
	};

	type OptionsResponse = {
		trainers: Option[];
		locations: Option[];
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
		action?: () => void;
	};

	type TableRow = { id: number } & Record<
		string,
		string | number | TableCellItem[] | boolean | null
	>;

	const priorityOptions: { value: PriorityValue; label: string }[] = [
		{ value: 'attention', label: 'Behöver fokus' },
		{ value: 'urgent', label: 'Akuta' },
		{ value: 'watch', label: 'Bevaka' },
		{ value: 'all', label: 'Alla' }
	];

	const clientOptions: { value: ClientValue; label: string }[] = [
		{ value: 'active', label: 'Aktiva' },
		{ value: 'inactive', label: 'Inaktiva' },
		{ value: 'all', label: 'Alla' }
	];

	const capacityOptions: DropdownOption[] = [
		{ value: 'all', label: 'Alla' },
		{ value: 'full', label: 'Fullbokade' },
		{ value: 'near_full', label: 'Nära fullbokade' },
		{ value: 'open', label: 'Övriga' }
	];

	const frozenOptions: DropdownOption[] = [
		{ value: 'exclude_frozen', label: 'Exkludera frysta' },
		{ value: 'only_frozen', label: 'Endast frysta' },
		{ value: 'all', label: 'Alla' }
	];

	let priorityFilter: PriorityValue = 'attention';
	let clientFilter: ClientValue = 'active';
	let capacityFilter: CapacityValue = 'all';
	let frozenFilter: FrozenValue = 'exclude_frozen';
	let nearFullThreshold = '3';
	let closeToLastBookingDays = '30';

	let selectedPriorityOption = priorityOptions[0];
	let selectedClientOption = clientOptions[0];

	$: selectedPriorityOption =
		priorityOptions.find((option) => option.value === priorityFilter) ?? priorityOptions[0];
	$: selectedClientOption =
		clientOptions.find((option) => option.value === clientFilter) ?? clientOptions[0];

	let trainers: Option[] = [];
	let locations: Option[] = [];
	let trainerId = '';
	let locationId = '';
	let searchQuery = '';

	let trainerFilterOptions: DropdownOption[] = [{ value: '', label: 'Alla tränare' }];
	let locationFilterOptions: DropdownOption[] = [{ value: '', label: 'Alla studios' }];

	let headers: Header[] = [
		{ label: 'Prioritet', key: 'priority', sort: true, width: '120px' },
		{ label: 'Orsak', key: 'reason', isSearchable: true, width: '260px' },
		{ label: 'Kvar att boka', key: 'remainingBooked', sort: true, width: '120px' },
		{ label: 'Kvar att genomföra', key: 'remainingPassed', sort: true, width: '140px' },
		{ label: 'Paket', key: 'package', sort: true, width: '110px' },
		{ label: 'Produkt', key: 'article', sort: true, isSearchable: true, width: '170px' },
		{ label: 'Bokade / Totalt', key: 'bookedTotal', sort: true, width: '130px' },
		{ label: 'Genomförda / Totalt', key: 'bookedPassed', sort: true, width: '150px' },
		{ label: 'Sista bokning', key: 'lastBooking', sort: true, width: '150px' },
		{ label: 'Dagar till sista', key: 'daysToLast', sort: true, width: '130px' },
		{ label: 'Nästa bokning', key: 'nextBooking', sort: true, width: '150px' },
		{ label: 'Klient', key: 'client', sort: true, isSearchable: true, width: '190px' },
		{ label: 'Kund', key: 'customer', sort: true, isSearchable: true, width: '190px' },
		{ label: 'Tränare', key: 'trainer', sort: true, isSearchable: true, width: '170px' },
		{ label: 'Studio', key: 'location', sort: true, isSearchable: true, width: '150px' },
		{ label: 'Fryst', key: 'frozen', sort: true, width: '90px' },
		{ label: 'Första betalning', key: 'firstPayment', sort: true, width: '140px' }
	];

	const pageSize = 50;
	let page = 0;
	let hasMore = true;
	let loading = false;
	let pendingReset = false;

	let summary: Summary | null = null;
	let filteredSummary: Summary | null = null;
	let rows: TableRow[] = [];
	let tableData: TableType = [] as unknown as TableType;

	let sentinel: HTMLDivElement | null = null;
	let observer: IntersectionObserver | null = null;
	let sentinelObserved = false;

	function parsePositiveInt(value: string, fallback: number) {
		const parsed = Number.parseInt(value, 10);
		if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
		return parsed;
	}

	function formatDate(value: string | null, includeTime = false) {
		if (!value) return '—';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		try {
			return new Intl.DateTimeFormat('sv-SE', {
				dateStyle: 'short',
				timeStyle: includeTime ? 'short' : undefined
			}).format(date);
		} catch {
			return value;
		}
	}

	function onGoToPackage(id: number) {
		goto(`/settings/packages/${id}`);
	}

	function onGoToClient(id: number | null) {
		if (!id) return;
		goto(`/clients/${id}`);
	}

	function onGoToTrainer(id: number | null) {
		if (!id) return;
		goto(`/users/${id}`);
	}

	function buildCustomerLabel(row: ApiRow) {
		if (!row.customerName) return '—';
		return row.customerNo ? `${row.customerName} (${row.customerNo})` : row.customerName;
	}

	function formatDays(value: number | null) {
		if (value === null) return '—';
		if (value < 0) return `${Math.abs(value)} dagar sedan`;
		if (value === 0) return 'Idag';
		return `${value} dagar`;
	}

	function mapToTableRow(row: ApiRow): TableRow {
		const packageCell: TableCellItem[] = [
			{
				type: 'link',
				label: `#${row.packageId}`,
				action: () => onGoToPackage(row.packageId)
			}
		];

		const clientCell =
			row.clientId && row.clientName
				? [
						{
							type: 'link',
							label: row.clientName,
							action: () => onGoToClient(row.clientId)
						}
					]
				: (row.clientName ?? '—');

		const trainerCell =
			row.primaryTrainerId && row.primaryTrainerName
				? [
						{
							type: 'link',
							label: row.primaryTrainerName,
							action: () => onGoToTrainer(row.primaryTrainerId)
						}
					]
				: (row.primaryTrainerName ?? '—');

		return {
			id: row.packageId,
			priority: row.priorityLabel,
			reason: row.urgencyReason,
			remainingBooked: row.remainingByBooked,
			remainingPassed: row.remainingByPassed,
			package: packageCell,
			article: row.articleName ?? '—',
			bookedTotal: `${row.bookedTotal} / ${row.totalSessions}`,
			bookedPassed: `${row.bookedPassed} / ${row.totalSessions}`,
			lastBooking: formatDate(row.lastBookingAt, true),
			daysToLast: formatDays(row.daysToLastBooking),
			nextBooking: formatDate(row.nextBookingAt, true),
			client: clientCell,
			customer: buildCustomerLabel(row),
			trainer: trainerCell,
			location: row.primaryLocationName ?? '—',
			frozen: row.isFrozen ? 'Ja' : 'Nej',
			firstPayment: formatDate(row.firstPaymentDate, false)
		};
	}

	function buildParams(includePagination: boolean) {
		const params = new URLSearchParams({
			priority: priorityFilter,
			capacity: capacityFilter,
			client: clientFilter,
			frozen: frozenFilter,
			nearFullThreshold: String(parsePositiveInt(nearFullThreshold, 3)),
			closeToLastBookingDays: String(parsePositiveInt(closeToLastBookingDays, 30))
		});

		if (trainerId) params.set('trainerId', trainerId);
		if (locationId) params.set('locationId', locationId);

		const trimmedSearch = searchQuery.trim();
		if (trimmedSearch) params.set('search', trimmedSearch);

		if (includePagination) {
			params.set('limit', String(pageSize));
			params.set('offset', String(page * pageSize));
		}

		return params;
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
			const params = buildParams(true);
			const res = await fetch(`/api/reports/package-renewal?${params.toString()}`);
			if (!res.ok) throw new Error('Kunde inte hämta paketförnyelserapporten');
			const json: ApiResponse = await res.json();

			summary = json.summary;
			filteredSummary = json.filteredSummary;

			const mapped = json.rows.map(mapToTableRow);
			rows = reset ? mapped : [...rows, ...mapped];
			tableData = rows as unknown as TableType;
			page += 1;
			hasMore = json.rows.length === pageSize;
		} catch (error) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ladda paketförnyelserapporten',
				description: (error as Error).message
			});
			if (reset) {
				rows = [];
				tableData = [] as unknown as TableType;
				summary = null;
				filteredSummary = null;
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

	async function fetchOptions() {
		try {
			const res = await fetch('/api/reports/package-renewal/options');
			if (!res.ok) throw new Error('Kunde inte hämta filteralternativ');
			const json: OptionsResponse = await res.json();
			trainers = json.trainers;
			locations = json.locations;
		} catch (error) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ladda filter',
				description: (error as Error).message
			});
		}
	}

	const debouncedSearch = debounce(() => fetchReport(true), 300);

	function onPrioritySelect(event: CustomEvent<PriorityValue>) {
		priorityFilter = event.detail;
		fetchReport(true);
	}

	function onClientSelect(event: CustomEvent<ClientValue>) {
		clientFilter = event.detail;
		fetchReport(true);
	}

	function onSelectFilterChange() {
		fetchReport(true);
	}

	onMount(() => {
		fetchOptions();
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

	$: trainerFilterOptions = [
		{ value: '', label: 'Alla tränare' },
		...trainers.map((option) => ({ value: String(option.id), label: option.label }))
	];

	$: locationFilterOptions = [
		{ value: '', label: 'Alla studios' },
		...locations.map((option) => ({ value: String(option.id), label: option.label }))
	];

	async function exportExcel() {
		let success = false;
		try {
			const params = buildParams(false);
			const res = await fetch(`/api/reports/package-renewal/export?${params.toString()}`);
			if (!res.ok) throw new Error('Kunde inte skapa Excel');

			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'paketfornyelse.xlsx';
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
	<div class="mb-4 flex items-center justify-between gap-3">
		<div class="flex items-center gap-2">
			<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
				<Icon icon="Package" size="14px" />
			</div>
			<h2 class="text-text text-3xl font-semibold">Paketförnyelse</h2>
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

	<div class="mb-6 flex flex-col gap-3">
		<OptionButton
			label="Förnyelsefokus"
			options={priorityOptions}
			selectedOption={selectedPriorityOption}
			on:select={onPrioritySelect}
			size="small"
			full
		/>
		<OptionButton
			label="Klienter"
			options={clientOptions}
			selectedOption={selectedClientOption}
			on:select={onClientSelect}
			size="small"
		/>
	</div>

	<div class="mb-3 grid gap-3 md:grid-cols-3">
		<Dropdown
			id="package-renewal-capacity"
			label="Kapacitet"
			options={capacityOptions}
			bind:selectedValue={capacityFilter}
			on:change={onSelectFilterChange}
		/>

		<Dropdown
			id="package-renewal-frozen"
			label="Frysta paket"
			options={frozenOptions}
			bind:selectedValue={frozenFilter}
			on:change={onSelectFilterChange}
		/>

		<Input
			label="Sök"
			name="package-renewal-search"
			placeholder="Sök paket, klient, kund, tränare..."
			bind:value={searchQuery}
			on:input={debouncedSearch}
		/>
	</div>

	<div class="mb-3 grid gap-3 md:grid-cols-2">
		<Dropdown
			id="package-renewal-trainer"
			label="Tränare"
			options={trainerFilterOptions}
			search
			maxNumberOfSuggestions={15}
			infiniteScroll
			bind:selectedValue={trainerId}
			on:change={onSelectFilterChange}
		/>

		<Dropdown
			id="package-renewal-location"
			label="Studio"
			options={locationFilterOptions}
			search
			maxNumberOfSuggestions={15}
			infiniteScroll
			bind:selectedValue={locationId}
			on:change={onSelectFilterChange}
		/>
	</div>

	<div class="mb-6 grid gap-3 md:grid-cols-2">
		<Input
			label="Nära fullbokad (bokningar kvar)"
			name="package-renewal-threshold-near"
			type="number"
			min={1}
			max={100}
			bind:value={nearFullThreshold}
			on:change={onSelectFilterChange}
		/>
		<Input
			label="Nära sista bokning (dagar)"
			name="package-renewal-threshold-last"
			type="number"
			min={1}
			max={365}
			bind:value={closeToLastBookingDays}
			on:change={onSelectFilterChange}
		/>
	</div>

	{#if filteredSummary}
		<div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Visade paket</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.total}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Akuta</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.urgent}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Bevaka</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.watch}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Fullbokade</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.fullBooked}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Nära fullbokade</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.nearFull}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Frysta</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.frozen}</p>
			</div>
		</div>
	{/if}

	{#if summary}
		<p class="text-text/60 mb-3 text-sm">
			Genomsnitt kvar att boka: <strong>{summary.avgRemainingByBooked}</strong> pass. Genomsnitt kvar att
			genomföra: <strong>{summary.avgRemainingByPassed}</strong> pass. Uppdaterad {formatDate(summary.generatedAt, true)}.
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
