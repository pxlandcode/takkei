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

	type PackageStatusOption = {
		value: 'all' | 'missing' | 'linked';
		label: string;
	};

	type CancellationOption = {
		value: 'chargeable' | 'booked_only' | 'late_cancelled_only';
		label: string;
	};

	type Summary = {
		total: number;
		linked: number;
		withoutPackage: number;
		missingPackage: number;
		notApplicable: number;
		packageRelevant: number;
		cancelled: number;
		lateCancelled: number;
		firstBookingAt: string | null;
		lastBookingAt: string | null;
		generatedAt: string;
	};

	type ApiRow = {
		bookingId: number;
		startTime: string | null;
		status: string | null;
		clientId: number | null;
		clientName: string | null;
		clientCustomers: string | null;
		trainerId: number | null;
		trainerName: string | null;
		locationId: number | null;
		locationName: string | null;
		bookingKind: string | null;
		packageId: number | null;
		packageArticleName: string | null;
		packageCustomerName: string | null;
		packageClientName: string | null;
		packagePaidPrice: number | null;
		packageSessions: number | null;
		addedToPackageDate: string | null;
		internal: boolean;
		education: boolean;
		tryOut: boolean;
		internalEducation: boolean;
		packageRelevant: boolean;
		hasPackage: boolean;
		noPackage: boolean;
		missingPackage: boolean;
		packageNotApplicable: boolean;
		isCancelled: boolean;
		isLateCancelled: boolean;
		packageStatus: 'linked' | 'missing';
		packageStatusLabel: string;
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
		action?: () => void;
	};

	type TableRow = { id: number } & Record<
		string,
		string | number | TableCellItem[] | boolean | null
	>;

	const packageStatusOptions: PackageStatusOption[] = [
		{ value: 'missing', label: 'Saknar paket' },
		{ value: 'linked', label: 'Har paket' },
		{ value: 'all', label: 'Alla' }
	];

	const cancellationOptions: CancellationOption[] = [
		{ value: 'chargeable', label: 'Debiterbara' },
		{ value: 'booked_only', label: 'Endast bokade' },
		{ value: 'late_cancelled_only', label: 'Endast sent avbokade' }
	];

	let packageStatus: PackageStatusOption['value'] = packageStatusOptions[0].value;
	let cancellation: CancellationOption['value'] = cancellationOptions[0].value;
	let selectedPackageStatus: PackageStatusOption = packageStatusOptions[0];
	let selectedCancellation: CancellationOption = cancellationOptions[0];

	$: selectedPackageStatus =
		packageStatusOptions.find((option) => option.value === packageStatus) ?? packageStatusOptions[0];
	$: selectedCancellation =
		cancellationOptions.find((option) => option.value === cancellation) ?? cancellationOptions[0];
	let dateFrom = '';
	let dateTo = '';
	let searchQuery = '';

	let headers: Header[] = [
		{ label: 'Start', key: 'startTime', sort: true, width: '150px' },
		{ label: 'Paketstatus', key: 'packageStatus', sort: true, width: '130px' },
		{ label: 'Status', key: 'status', sort: true, isSearchable: true, width: '120px' },
		{ label: 'Bokning', key: 'bookingId', sort: true, width: '100px' },
		{ label: 'Klient', key: 'client', sort: true, isSearchable: true, width: '170px' },
		{ label: 'Kunder', key: 'clientCustomers', isSearchable: true, width: '180px' },
		{ label: 'Tränare', key: 'trainer', sort: true, isSearchable: true, width: '150px' },
		{ label: 'Typ', key: 'bookingKind', sort: true, isSearchable: true, width: '140px' },
		{ label: 'Plats', key: 'location', sort: true, isSearchable: true, width: '130px' },
		{ label: 'Paket', key: 'package', sort: true, width: '110px' },
		{ label: 'Produkt', key: 'packageProduct', sort: true, isSearchable: true, width: '180px' },
		{ label: 'Paketkund', key: 'packageCustomer', sort: true, isSearchable: true, width: '180px' },
		{ label: 'Paketrelevant', key: 'packageRelevant', sort: true, width: '120px' },
		{ label: 'Tillagd', key: 'addedToPackage', sort: true, width: '150px' },
		{ label: 'Flaggor', key: 'flags', isSearchable: true, width: '180px' }
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

	function formatMoney(value: number | null) {
		if (value === null || value === undefined) return '—';
		try {
			return new Intl.NumberFormat('sv-SE', {
				style: 'currency',
				currency: 'SEK',
				maximumFractionDigits: 2
			}).format(value);
		} catch {
			return String(value);
		}
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

	function buildFlagsLabel(row: ApiRow) {
		const flags: string[] = [];
		if (row.internal) flags.push('Intern');
		if (row.education) flags.push('Utbildning');
		if (row.tryOut) flags.push('Prova på');
		if (row.internalEducation) flags.push('Praktik');
		return flags.length ? flags.join(', ') : '—';
	}

	function formatBookingStatus(status: string | null) {
		const normalized = (status ?? '').trim();
		if (!normalized || normalized === 'New') return 'Bokad';
		if (normalized === 'Late_cancelled') return 'Sent avbokad';
		if (normalized === 'Cancelled') return 'Avbokad';
		return normalized;
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

		const productLabelParts = [
			row.packageArticleName,
			row.packagePaidPrice !== null ? `(${formatMoney(row.packagePaidPrice)})` : null
		].filter(Boolean);

		return {
			id: row.bookingId,
			startTime: formatDate(row.startTime, true),
			packageStatus: row.packageStatusLabel,
			status: formatBookingStatus(row.status),
			bookingId: row.bookingId,
			client: clientCell,
			clientCustomers: row.clientCustomers ?? '—',
			trainer: trainerCell,
			bookingKind: row.bookingKind ?? '—',
			location: row.locationName ?? '—',
			package: packageCell,
			packageProduct: productLabelParts.length ? productLabelParts.join(' ') : '—',
			packageCustomer: row.packageCustomerName ?? '—',
			packageRelevant: row.packageRelevant ? 'Ja' : 'Nej',
			addedToPackage: formatDate(row.addedToPackageDate, true),
			flags: buildFlagsLabel(row)
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
			params.set('packageStatus', packageStatus);
			params.set('cancellation', cancellation);
			params.set('limit', String(pageSize));
			params.set('offset', String(page * pageSize));
			if (dateFrom) params.set('dateFrom', dateFrom);
			if (dateTo) params.set('dateTo', dateTo);
			const trimmedSearch = searchQuery.trim();
			if (trimmedSearch) params.set('search', trimmedSearch);

			const res = await fetch(`/api/reports/package-bookings?${params.toString()}`);
			if (!res.ok) throw new Error('Kunde inte hämta paketrapporten');
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
				message: 'Kunde inte ladda paketrapporten',
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

	const debouncedSearch = debounce(() => fetchReport(true), 300);

	async function exportExcel() {
		let success = false;
		try {
			const params = new URLSearchParams();
			params.set('packageStatus', packageStatus);
			params.set('cancellation', cancellation);
			if (dateFrom) params.set('dateFrom', dateFrom);
			if (dateTo) params.set('dateTo', dateTo);
			const trimmedSearch = searchQuery.trim();
			if (trimmedSearch) params.set('search', trimmedSearch);

			const res = await fetch(`/api/reports/package-bookings/export?${params.toString()}`);
			if (!res.ok) throw new Error('Kunde inte skapa Excel');

			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `paketbokningar_${packageStatus}.xlsx`;
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

	onMount(() => {
		const today = new Date();
		const start = new Date(today);
		start.setDate(start.getDate() - 90);

		dateFrom = formatDateInput(start);
		dateTo = formatDateInput(today);
		fetchReport(true);
	});

	function onPackageStatusSelect(event: CustomEvent<PackageStatusOption['value']>) {
		packageStatus = event.detail;
		fetchReport(true);
	}

	function onCancellationSelect(event: CustomEvent<CancellationOption['value']>) {
		cancellation = event.detail;
		fetchReport(true);
	}

	function onDateFilterChange() {
		fetchReport(true);
	}
</script>

<div class="custom-scrollbar m-4 h-full overflow-x-auto">
	<div class="mb-4 flex items-center gap-2">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Package" size="14px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">Paketrapport</h2>
	</div>

	<div class="mb-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
		<div class="flex flex-col gap-3">
			<div class="flex flex-col gap-3">
				<label class="flex flex-col gap-1">
					<span class="text-text/70 text-sm">Paketstatus</span>
					<OptionButton
						options={packageStatusOptions}
						selectedOption={selectedPackageStatus}
						on:select={onPackageStatusSelect}
						size="small"
						full
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-text/70 text-sm">Debiteringsfilter</span>
					<OptionButton
						options={cancellationOptions}
						selectedOption={selectedCancellation}
						on:select={onCancellationSelect}
						size="small"
						full
					/>
				</label>
			</div>

			<div class="grid gap-3 sm:grid-cols-3">
				<label class="flex flex-col gap-1">
					<span class="text-text/70 text-sm">Från datum</span>
					<input
						type="date"
						bind:value={dateFrom}
						on:change={onDateFilterChange}
						class="w-full rounded-sm border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-text/70 text-sm">Till datum</span>
					<input
						type="date"
						bind:value={dateTo}
						on:change={onDateFilterChange}
						class="w-full rounded-sm border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-text/70 text-sm">Sök</span>
					<input
						type="text"
						bind:value={searchQuery}
						on:input={debouncedSearch}
						placeholder="Sök klient, tränare, paket, produkt..."
						class="w-full rounded-sm border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
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
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Visade bokningar</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.total}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Saknar paket</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.missingPackage}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Har paket</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.linked}</p>
			</div>
			<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-text/70 text-sm">Sent avbokade</p>
				<p class="text-text text-2xl font-semibold">{filteredSummary.lateCancelled}</p>
			</div>
		</div>
	{/if}

	{#if summary}
		<p class="text-text/60 mb-3 text-sm">
			Vald period innehåller <strong>{summary.total}</strong> bokningar efter debiteringsfilter.
			Saknar paket: <strong>{summary.missingPackage}</strong>, har paket:
			<strong>{summary.linked}</strong>, sent avbokade:
			<strong>{summary.lateCancelled}</strong>. Uppdaterad {formatDate(summary.generatedAt, true)}.
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
		<div class="mt-4 flex justify-center">
			{#if hasMore}
				<Button
					text={loading ? 'Laddar…' : 'Ladda fler'}
					variant="secondary"
					on:click={() => fetchReport(false)}
					disabled={loading}
				/>
			{:else}
				<p class="text-text/60 py-2 text-sm">Inga fler rader att visa.</p>
			{/if}
		</div>
	{/if}
</div>
