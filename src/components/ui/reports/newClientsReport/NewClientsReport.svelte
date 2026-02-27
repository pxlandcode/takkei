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
	import { Datepicker } from '@pixelcode_/blocks/components';

	type QuickRangeValue = 'this_month' | 'this_week' | 'last_week' | 'last_month' | 'custom';
	type QuickRangeOption = { value: QuickRangeValue; label: string };
	type ActiveFilterValue = 'all' | 'active' | 'inactive';
	type StartedFilterValue = 'all' | 'started' | 'not_started';
	type ActiveOption = { value: ActiveFilterValue; label: string };
	type StartedOption = { value: StartedFilterValue; label: string };
	type Option = { id: number; label: string };
	type DropdownOption = { value: string; label: string };

	type Summary = {
		total: number;
		active: number;
		inactive: number;
		started: number;
		notStarted: number;
		withTrialBookings: number;
		trialBookingsTotal: number;
		withFirstBooking: number;
		withFirstRegularBooking: number;
		generatedAt: string;
		periodStart: string;
		periodEnd: string;
	};

	type ApiRow = {
		id: number;
		name: string;
		firstname: string;
		lastname: string;
		email: string | null;
		phone: string | null;
		active: boolean;
		hasStarted: boolean;
		primaryTrainerId: number | null;
		primaryTrainerName: string | null;
		primaryLocationId: number | null;
		primaryLocationName: string | null;
		createdAt: string | null;
		firstBookingAt: string | null;
		firstTrialBookingAt: string | null;
		firstRegularBookingAt: string | null;
		trialBookings: number;
		regularBookings: number;
		totalBookings: number;
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

	const quickRangeOptions: QuickRangeOption[] = [
		{ value: 'this_month', label: 'Denna månad' },
		{ value: 'this_week', label: 'Denna vecka' },
		{ value: 'last_week', label: 'Förra veckan' },
		{ value: 'last_month', label: 'Förra månaden' },
		{ value: 'custom', label: 'Eget val' }
	];

	const activeOptions: ActiveOption[] = [
		{ value: 'all', label: 'Alla' },
		{ value: 'active', label: 'Aktiva' },
		{ value: 'inactive', label: 'Inaktiva' }
	];

	const startedOptions: StartedOption[] = [
		{ value: 'all', label: 'Alla' },
		{ value: 'started', label: 'Har börjat' },
		{ value: 'not_started', label: 'Ej börjat' }
	];

	const datePickerOptions = {
		dateFormat: 'yyyy-MM-dd'
	} as const;

	let quickRange: QuickRangeValue = 'this_month';
	let selectedQuickRange: QuickRangeOption = quickRangeOptions[0];
	$: selectedQuickRange =
		quickRangeOptions.find((option) => option.value === quickRange) ?? quickRangeOptions[0];

	let activeFilter: ActiveOption = activeOptions[0];
	let startedFilter: StartedOption = startedOptions[0];

	let trainers: Option[] = [];
	let locations: Option[] = [];
	let trainerId = '';
	let locationId = '';
	let trainerFilterOptions: DropdownOption[] = [{ value: '', label: 'Alla tränare' }];
	let locationFilterOptions: DropdownOption[] = [{ value: '', label: 'Alla studios' }];

	let dateFrom = '';
	let dateTo = '';
	let searchQuery = '';

	let headers: Header[] = [
		{ label: 'Namn', key: 'name', sort: true, isSearchable: true, width: '180px' },
		{ label: 'Aktiv', key: 'active', sort: true, width: '100px' },
		{ label: 'Har börjat', key: 'started', sort: true, width: '120px' },
		{ label: 'Skapad', key: 'createdAt', sort: true, width: '150px' },
		{ label: 'Första bokning', key: 'firstBooking', sort: true, width: '160px' },
		{ label: 'Första provbokning', key: 'firstTrialBooking', sort: true, width: '170px' },
		{ label: 'Första träning', key: 'firstRegularBooking', sort: true, width: '160px' },
		{ label: 'Provbokningar', key: 'trialBookings', sort: true, width: '120px' },
		{ label: 'Vanliga bokningar', key: 'regularBookings', sort: true, width: '130px' },
		{ label: 'Totala bokningar', key: 'totalBookings', sort: true, width: '120px' },
		{ label: 'Primär tränare', key: 'primaryTrainer', sort: true, isSearchable: true, width: '170px' },
		{ label: 'Primär studio', key: 'primaryLocation', sort: true, isSearchable: true, width: '150px' },
		{ label: 'E-post', key: 'email', isSearchable: true, width: '220px' },
		{ label: 'Telefon', key: 'phone', isSearchable: true, width: '140px' }
	];

	const pageSize = 50;
	let page = 0;
	let hasMore = true;
	let loading = false;
	let filtersReady = false;
	let summary: Summary | null = null;
	let filteredSummary: Summary | null = null;
	let rows: TableRow[] = [];
	let tableData: TableType = [] as unknown as TableType;
	let sentinel: HTMLDivElement | null = null;
	let observer: IntersectionObserver | null = null;
	let sentinelObserved = false;
	let lastActiveValue: ActiveFilterValue = activeFilter.value;
	let lastStartedValue: StartedFilterValue = startedFilter.value;
	let pendingReset = false;
	let dateFiltersInitialized = false;
	let lastDateRangeSignature = '';
	let ignoreDateFilterSync = 0;

	function pad2(value: number) {
		return String(value).padStart(2, '0');
	}

	function formatDateInput(date: Date) {
		return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
	}

	function startOfWeek(date: Date) {
		const d = new Date(date);
		const day = d.getDay();
		const diffToMonday = day === 0 ? -6 : 1 - day;
		d.setDate(d.getDate() + diffToMonday);
		d.setHours(0, 0, 0, 0);
		return d;
	}

	function applyQuickRange(value: QuickRangeValue, shouldFetch = true) {
		quickRange = value;
		if (value === 'custom') return;

		const today = new Date();
		const end = new Date(today);
		let start = new Date(today);

		if (value === 'this_month') {
			start = new Date(today.getFullYear(), today.getMonth(), 1);
			end.setFullYear(today.getFullYear(), today.getMonth() + 1, 0);
		} else if (value === 'this_week') {
			start = startOfWeek(today);
			end.setTime(start.getTime());
			end.setDate(end.getDate() + 6);
		} else if (value === 'last_week') {
			const thisWeekStart = startOfWeek(today);
			start = new Date(thisWeekStart);
			start.setDate(start.getDate() - 7);
			end.setTime(start.getTime());
			end.setDate(end.getDate() + 6);
		} else if (value === 'last_month') {
			start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
			end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
		}

		ignoreDateFilterSync += 1;
		dateFrom = formatDateInput(start);
		dateTo = formatDateInput(end);
		if (shouldFetch) fetchReport(true);
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

	function mapToTableRow(row: ApiRow): TableRow {
		const nameCell: TableCellItem[] = [
			{
				type: 'link',
				label: row.name,
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

		return {
			id: row.id,
			name: nameCell,
			active: row.active ? 'Ja' : 'Nej',
			started: row.hasStarted ? 'Ja' : 'Nej',
			createdAt: formatDate(row.createdAt, true),
			firstBooking: formatDate(row.firstBookingAt, true),
			firstTrialBooking: formatDate(row.firstTrialBookingAt, true),
			firstRegularBooking: formatDate(row.firstRegularBookingAt, true),
			trialBookings: row.trialBookings,
			regularBookings: row.regularBookings,
			totalBookings: row.totalBookings,
			primaryTrainer: trainerCell,
			primaryLocation: row.primaryLocationName ?? 'Ingen',
			email: row.email ?? '—',
			phone: row.phone ?? '—'
		};
	}

	function buildParams(includePagination: boolean) {
		const params = new URLSearchParams({
			active: activeFilter.value,
			started: startedFilter.value,
			dateFrom,
			dateTo
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
			const res = await fetch(`/api/reports/new-clients?${params.toString()}`);
			if (!res.ok) throw new Error('Kunde inte hämta rapporten Nya klienter');
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

	async function fetchOptions() {
		try {
			const res = await fetch('/api/reports/new-clients/options');
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

	function onQuickRangeSelect(event: CustomEvent<QuickRangeValue>) {
		applyQuickRange(event.detail, true);
	}

	function onSelectFilterChange() {
		fetchReport(true);
	}

	onMount(() => {
		applyQuickRange('this_month', false);
		lastDateRangeSignature = `${dateFrom}|${dateTo}`;
		dateFiltersInitialized = true;
		filtersReady = true;

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

	$: if (filtersReady && activeFilter.value !== lastActiveValue) {
		lastActiveValue = activeFilter.value;
		fetchReport(true);
	}

	$: if (filtersReady && startedFilter.value !== lastStartedValue) {
		lastStartedValue = startedFilter.value;
		fetchReport(true);
	}

	$: dateRangeSignature = `${dateFrom}|${dateTo}`;
	$: if (filtersReady && dateFiltersInitialized && dateRangeSignature !== lastDateRangeSignature) {
		lastDateRangeSignature = dateRangeSignature;
		if (ignoreDateFilterSync > 0) {
			ignoreDateFilterSync -= 1;
		} else {
			quickRange = 'custom';
			fetchReport(true);
		}
	}

	async function exportExcel() {
		let success = false;
		try {
			const params = buildParams(false);
			const res = await fetch(`/api/reports/new-clients/export?${params.toString()}`);
			if (!res.ok) throw new Error('Kunde inte skapa Excel');
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `nya-klienter_${dateFrom}_${dateTo}.xlsx`;
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
				<Icon icon="Person" size="14px" />
			</div>
			<h2 class="text-text text-3xl font-semibold">Nya klienter</h2>
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

	<div class="mb-6">
		<div class="flex flex-col gap-3">
			<label class="flex flex-col gap-1">
				<span class="text-text/70 text-sm">Snabbval period</span>
				<OptionButton
					options={quickRangeOptions}
					selectedOption={selectedQuickRange}
					on:select={onQuickRangeSelect}
					size="small"
					full
				/>
			</label>

			<div class="grid gap-3 sm:grid-cols-2">
				<label class="flex flex-col gap-1">
					<span class="text-text/70 text-sm">Från datum</span>
					<Datepicker bind:value={dateFrom} options={datePickerOptions} placeholder="Välj datum" />
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-text/70 text-sm">Till datum</span>
					<Datepicker bind:value={dateTo} options={datePickerOptions} placeholder="Välj datum" />
				</label>
			</div>
		</div>
	</div>

	<div class="mb-3 grid gap-3 md:grid-cols-3">
		<Dropdown
			id="new-clients-report-trainer"
			label="Tränare"
			options={trainerFilterOptions}
			search
			maxNumberOfSuggestions={15}
			infiniteScroll
			bind:selectedValue={trainerId}
			on:change={onSelectFilterChange}
		/>

		<Dropdown
			id="new-clients-report-location"
			label="Studio"
			options={locationFilterOptions}
			search
			maxNumberOfSuggestions={15}
			infiniteScroll
			bind:selectedValue={locationId}
			on:change={onSelectFilterChange}
		/>

		<Input
			label="Sök"
			name="new-clients-report-search"
			placeholder="Sök namn, e-post, tränare, studio..."
			bind:value={searchQuery}
			on:input={debouncedSearch}
		/>
	</div>

	<div class="mb-6 flex flex-col gap-3">
		<OptionButton label="Klienter" options={activeOptions} bind:selectedOption={activeFilter} size="small" />
		<OptionButton
			label="Startstatus"
			options={startedOptions}
			bind:selectedOption={startedFilter}
			size="small"
		/>
	</div>

	{#if filteredSummary}
		<div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Visade nya klienter</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.total}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Aktiva</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.active}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Inaktiva</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.inactive}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Har börjat träna</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.started}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Ej börjat träna</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.notStarted}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Klienter med provbokning</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.withTrialBookings}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Totala provbokningar</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.trialBookingsTotal}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Har första bokning</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.withFirstBooking}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Har första träning</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.withFirstRegularBooking}</p>
			</div>
		</div>
	{/if}

	{#if summary}
		<p class="text-text/60 mb-2 text-sm">
			Totalt i vald period: <strong>{summary.total}</strong> nya klienter. Uppdaterad
			{formatDate(summary.generatedAt, true)}.
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
