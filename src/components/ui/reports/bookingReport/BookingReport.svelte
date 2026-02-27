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
	type Option = { id: number; label: string };
	type DropdownOption = { value: string; label: string };

	type SummaryLocation = {
		locationId: number | null;
		locationName: string;
		total: number;
		booked: number;
		lateCancelled: number;
		cancelled: number;
	};

	type Summary = {
		total: number;
		booked: number;
		lateCancelled: number;
		cancelled: number;
		chargeable: number;
		missingPackage: number;
		firstBookingAt: string | null;
		lastBookingAt: string | null;
		locationBreakdown: SummaryLocation[];
		generatedAt: string;
	};

	type ApiRow = {
		bookingId: number;
		startTime: string | null;
		status: string | null;
		statusLabel: string;
		bookingType: 'regular' | 'demo' | 'education' | 'internal' | 'internal_education';
		bookingTypeLabel: string;
		clientId: number | null;
		clientName: string | null;
		trainerId: number | null;
		trainerName: string | null;
		locationId: number | null;
		locationName: string | null;
		roomId: number | null;
		roomName: string | null;
		trainingTypeId: number | null;
		trainingTypeKind: string | null;
		packageId: number | null;
		packageArticleId: number | null;
		packageArticleName: string | null;
		missingPackage: boolean;
		isChargeable: boolean;
		isCancelled: boolean;
		isLateCancelled: boolean;
		isDemo: boolean;
		isSaldoAdjustment: boolean;
		markings: string[];
	};

	type ApiResponse = {
		rows: ApiRow[];
		summary: Summary;
		filteredSummary: Summary;
	};

	type OptionsResponse = {
		trainers: Option[];
		clients: Option[];
		locations: Option[];
		packageArticles: Option[];
		trainingTypes: Option[];
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

	const datePickerOptions = {
		dateFormat: 'yyyy-MM-dd'
	} as const;

	let quickRange: QuickRangeValue = 'this_month';
	let selectedQuickRange: QuickRangeOption = quickRangeOptions[0];
	$: selectedQuickRange =
		quickRangeOptions.find((option) => option.value === quickRange) ?? quickRangeOptions[0];

	const statusOptions: DropdownOption[] = [
		{ value: 'chargeable', label: 'Debiterbara' },
		{ value: 'booked', label: 'Endast bokade' },
		{ value: 'late_cancelled', label: 'Endast sent avbokade' },
		{ value: 'cancelled', label: 'Endast avbokade' },
		{ value: 'all', label: 'Alla statusar' }
	];

	const bookingTypeOptions: DropdownOption[] = [
		{ value: 'all', label: 'Alla typer' },
		{ value: 'regular', label: 'Vanlig' },
		{ value: 'demo', label: 'Demo' },
		{ value: 'education', label: 'Utbildning' },
		{ value: 'internal', label: 'Intern' },
		{ value: 'internal_education', label: 'Praktiktimme' }
	];

	let trainers: Option[] = [];
	let clients: Option[] = [];
	let locations: Option[] = [];
	let packageArticles: Option[] = [];
	let trainingTypes: Option[] = [];

	let statusFilter = 'chargeable';
	let bookingTypeFilter = 'all';
	let trainerId = '';
	let clientId = '';
	let locationId = '';
	let packageArticleId = '';
	let trainingTypeId = '';
	let dateFrom = '';
	let dateTo = '';
	let searchQuery = '';

	let headers: Header[] = [
		{ label: 'Start', key: 'startTime', sort: true, width: '150px' },
		{ label: 'Status', key: 'status', sort: true, width: '140px' },
		{ label: 'Markeringar', key: 'markings', isSearchable: true, width: '180px' },
		{ label: 'Typ av bokning', key: 'bookingType', sort: true, width: '150px' },
		{ label: 'Typ av träning', key: 'trainingType', sort: true, isSearchable: true, width: '170px' },
		{ label: 'Klient', key: 'client', sort: true, isSearchable: true, width: '170px' },
		{ label: 'Tränare', key: 'trainer', sort: true, isSearchable: true, width: '170px' },
		{ label: 'Studio', key: 'location', sort: true, isSearchable: true, width: '150px' },
		{ label: 'Rum', key: 'room', sort: true, isSearchable: true, width: '130px' },
		{ label: 'Pakettyp', key: 'packageArticle', sort: true, isSearchable: true, width: '180px' },
		{ label: 'Paket', key: 'package', sort: true, width: '100px' },
		{ label: 'Bokning ID', key: 'bookingId', sort: true, width: '110px' }
	];

	const pageSize = 50;
	let page = 0;
	let hasMore = true;
	let loading = false;
	let pendingReset = false;
	let sentinel: HTMLDivElement | null = null;
	let observer: IntersectionObserver | null = null;
	let sentinelObserved = false;
	let dateFiltersInitialized = false;
	let lastDateRangeSignature = '';
	let ignoreDateFilterSync = 0;
	let trainerFilterOptions: DropdownOption[] = [{ value: '', label: 'Alla tränare' }];
	let clientFilterOptions: DropdownOption[] = [{ value: '', label: 'Alla klienter' }];
	let locationFilterOptions: DropdownOption[] = [{ value: '', label: 'Alla studios' }];
	let packageArticleFilterOptions: DropdownOption[] = [{ value: '', label: 'Alla pakettyper' }];
	let trainingTypeFilterOptions: DropdownOption[] = [{ value: '', label: 'Alla träningstyper' }];

	let summary: Summary | null = null;
	let filteredSummary: Summary | null = null;
	let rows: TableRow[] = [];
	let tableData: TableType = [] as unknown as TableType;

	function pad2(value: number) {
		return String(value).padStart(2, '0');
	}

	function formatDateInput(date: Date) {
		return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
	}

	function formatDate(value: string | null, includeTime = true) {
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

	function onGoToClient(id: number | null) {
		if (!id) return;
		goto(`/clients/${id}`);
	}

	function onGoToTrainer(id: number | null) {
		if (!id) return;
		goto(`/users/${id}`);
	}

	function onGoToPackage(id: number | null) {
		if (!id) return;
		goto(`/settings/packages/${id}`);
	}

	function mapToTableRow(row: ApiRow): TableRow {
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
			row.trainerId && row.trainerName
				? [
						{
							type: 'link',
							label: row.trainerName,
							action: () => onGoToTrainer(row.trainerId)
						}
					]
				: (row.trainerName ?? '—');

		const packageCell =
			row.packageId !== null
				? [
						{
							type: 'link',
							label: `#${row.packageId}`,
							action: () => onGoToPackage(row.packageId)
						}
					]
				: '—';

		return {
			id: row.bookingId,
			startTime: formatDate(row.startTime, true),
			status: row.statusLabel,
			markings: row.markings.length ? row.markings.join(', ') : '—',
			bookingType: row.bookingTypeLabel,
			trainingType: row.trainingTypeKind ?? '—',
			client: clientCell,
			trainer: trainerCell,
			location: row.locationName ?? '—',
			room: row.roomName ?? '—',
			packageArticle: row.packageArticleName ?? '—',
			package: packageCell,
			bookingId: row.bookingId
		};
	}

	function buildParams(includePagination: boolean) {
		const params = new URLSearchParams();
		params.set('status', statusFilter);
		params.set('bookingType', bookingTypeFilter);
		if (dateFrom) params.set('dateFrom', dateFrom);
		if (dateTo) params.set('dateTo', dateTo);
		if (trainerId) params.set('trainerId', trainerId);
		if (clientId) params.set('clientId', clientId);
		if (locationId) params.set('locationId', locationId);
		if (packageArticleId) params.set('packageArticleId', packageArticleId);
		if (trainingTypeId) params.set('trainingTypeId', trainingTypeId);
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
			const res = await fetch(`/api/reports/bookings?${params.toString()}`);
			if (!res.ok) throw new Error('Kunde inte hämta bokningsrapporten');
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
				message: 'Kunde inte ladda bokningsrapporten',
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
			const res = await fetch('/api/reports/bookings/options');
			if (!res.ok) throw new Error('Kunde inte hämta filteralternativ');
			const json: OptionsResponse = await res.json();
			trainers = json.trainers;
			clients = json.clients;
			locations = json.locations;
			packageArticles = json.packageArticles;
			trainingTypes = json.trainingTypes;
		} catch (error) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ladda filter',
				description: (error as Error).message
			});
		}
	}

	const debouncedSearch = debounce(() => fetchReport(true), 300);

	async function exportExcel() {
		let success = false;
		try {
			const params = buildParams(false);
			const res = await fetch(`/api/reports/bookings/export?${params.toString()}`);
			if (!res.ok) throw new Error('Kunde inte skapa Excel');

			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'bokningsrapport.xlsx';
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

	function onQuickRangeSelect(event: CustomEvent<QuickRangeValue>) {
		applyQuickRange(event.detail, true);
	}

	function onSelectFilterChange() {
		fetchReport(true);
	}

	onMount(() => {
		applyQuickRange('this_month', false);
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

	$: clientFilterOptions = [
		{ value: '', label: 'Alla klienter' },
		...clients.map((option) => ({ value: String(option.id), label: option.label }))
	];

	$: locationFilterOptions = [
		{ value: '', label: 'Alla studios' },
		...locations.map((option) => ({ value: String(option.id), label: option.label }))
	];

	$: packageArticleFilterOptions = [
		{ value: '', label: 'Alla pakettyper' },
		...packageArticles.map((option) => ({ value: String(option.id), label: option.label }))
	];

	$: trainingTypeFilterOptions = [
		{ value: '', label: 'Alla träningstyper' },
		...trainingTypes.map((option) => ({ value: String(option.id), label: option.label }))
	];

	$: dateRangeSignature = `${dateFrom}|${dateTo}`;

	$: if (!dateFiltersInitialized) {
		lastDateRangeSignature = dateRangeSignature;
		dateFiltersInitialized = true;
	} else if (dateRangeSignature !== lastDateRangeSignature) {
		lastDateRangeSignature = dateRangeSignature;
		if (ignoreDateFilterSync > 0) {
			ignoreDateFilterSync -= 1;
		} else {
			quickRange = 'custom';
			fetchReport(true);
		}
	}
</script>

<div class="custom-scrollbar m-4 h-full overflow-x-auto">
	<div class="mb-4 flex items-center gap-2">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Calendar" size="14px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">Bokningsrapport</h2>
	</div>

	<div class="mb-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
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

	<div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
		<Dropdown
			id="booking-report-status"
			label="Status"
			options={statusOptions}
			bind:selectedValue={statusFilter}
			on:change={onSelectFilterChange}
		/>

		<Dropdown
			id="booking-report-booking-type"
			label="Typ av bokning"
			options={bookingTypeOptions}
			bind:selectedValue={bookingTypeFilter}
			on:change={onSelectFilterChange}
		/>

		<Dropdown
			id="booking-report-trainer"
			label="Tränare"
			options={trainerFilterOptions}
			search
			maxNumberOfSuggestions={15}
			infiniteScroll
			bind:selectedValue={trainerId}
			on:change={onSelectFilterChange}
		/>

		<Dropdown
			id="booking-report-client"
			label="Klient"
			options={clientFilterOptions}
			search
			maxNumberOfSuggestions={15}
			infiniteScroll
			bind:selectedValue={clientId}
			on:change={onSelectFilterChange}
		/>

		<Dropdown
			id="booking-report-location"
			label="Studio"
			options={locationFilterOptions}
			search
			maxNumberOfSuggestions={15}
			infiniteScroll
			bind:selectedValue={locationId}
			on:change={onSelectFilterChange}
		/>

		<Dropdown
			id="booking-report-package-type"
			label="Typ av paket"
			options={packageArticleFilterOptions}
			search
			maxNumberOfSuggestions={15}
			infiniteScroll
			bind:selectedValue={packageArticleId}
			on:change={onSelectFilterChange}
		/>

		<Dropdown
			id="booking-report-training-type"
			label="Typ av träning"
			options={trainingTypeFilterOptions}
			search
			maxNumberOfSuggestions={15}
			infiniteScroll
			bind:selectedValue={trainingTypeId}
			on:change={onSelectFilterChange}
		/>

		<Input
			label="Sök"
			name="booking-report-search"
			placeholder="Sök klient, tränare, studio, paket..."
			bind:value={searchQuery}
			on:input={debouncedSearch}
		/>
	</div>

	{#if filteredSummary}
		<div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<div class="flex min-h-[110px] flex-col rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm leading-tight min-h-[48px]">Visade bokningar</p>
				<div class="flex flex-1 items-center justify-center">
					<p class="text-text text-center text-2xl font-semibold leading-none">
						{filteredSummary.total}
					</p>
				</div>
			</div>
			<div class="flex min-h-[110px] flex-col rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm leading-tight min-h-[48px]">Bokade</p>
				<div class="flex flex-1 items-center justify-center">
					<p class="text-text text-center text-2xl font-semibold leading-none">
						{filteredSummary.booked}
					</p>
				</div>
			</div>
			<div class="flex min-h-[110px] flex-col rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm leading-tight min-h-[48px]">Sent avbokade</p>
				<div class="flex flex-1 items-center justify-center">
					<p class="text-text text-center text-2xl font-semibold leading-none">
						{filteredSummary.lateCancelled}
					</p>
				</div>
			</div>
			<div class="flex min-h-[110px] flex-col rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm leading-tight min-h-[48px]">Avbokade</p>
				<div class="flex flex-1 items-center justify-center">
					<p class="text-text text-center text-2xl font-semibold leading-none">
						{filteredSummary.cancelled}
					</p>
				</div>
			</div>
			<div class="flex min-h-[110px] flex-col rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm leading-tight min-h-[48px]">Debiterbara</p>
				<div class="flex flex-1 items-center justify-center">
					<p class="text-text text-center text-2xl font-semibold leading-none">
						{filteredSummary.chargeable}
					</p>
				</div>
			</div>
			<div class="flex min-h-[110px] flex-col rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm leading-tight min-h-[48px]">Saknar paket</p>
				<div class="flex flex-1 items-center justify-center">
					<p class="text-text text-center text-2xl font-semibold leading-none">
						{filteredSummary.missingPackage}
					</p>
				</div>
			</div>
		</div>
	{/if}

	{#if filteredSummary?.locationBreakdown?.length}
		<div class="mb-5 rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
			<h3 class="text-text mb-3 text-lg font-semibold">Antal bokningar per studio</h3>
			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each filteredSummary.locationBreakdown as location (location.locationId ?? location.locationName)}
					<div class="rounded-sm border border-gray-200 p-3">
						<p class="text-text text-sm font-medium">{location.locationName}</p>
						<p class="text-text text-xl font-semibold">{location.total}</p>
						<div class="mt-2 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs">
							<span class="text-text/60">Bokade</span>
							<span class="text-text text-right font-medium tabular-nums">{location.booked}</span>
							<span class="text-text/60">Sent avbokade</span>
							<span class="text-text text-right font-medium tabular-nums">{location.lateCancelled}</span>
							<span class="text-text/60">Avbokade</span>
							<span class="text-text text-right font-medium tabular-nums">{location.cancelled}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if summary}
		<p class="text-text/60 mb-3 text-sm">
			I vald period/status finns totalt <strong>{summary.total}</strong> bokningar innan fritextsökning.
			Uppdaterad {formatDate(summary.generatedAt, true)}.
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
