<script lang="ts">
	import { onMount } from 'svelte';

	import { addToast } from '$lib/stores/toastStore';
	import type { TableType } from '$lib/types/componentTypes';
	import Table from '../../../bits/table/Table.svelte';
	import Button from '../../../bits/button/Button.svelte';
	import OptionButton from '../../../bits/optionButton/OptionButton.svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import { Datepicker } from '@pixelcode_/blocks/components';

	// ----- Filters -----
	function firstOfMonth(d = new Date()) {
		return new Date(d.getFullYear(), d.getMonth(), 1);
	}
	function toDateStr(d: Date) {
		return d.toISOString().slice(0, 10);
	}
	function toMonthStr(d: Date) {
		return d.toISOString().slice(0, 7); // YYYY-MM
	}

	let startMonth = toMonthStr(firstOfMonth()); // t.ex. "2025-08"
	let startMonthInput = startMonth;
	let endDate = toDateStr(new Date()); // t.ex. "2025-08-11"
	let includeZeroBalances = { value: 'no', label: 'Dölj nollsaldo' };

	type DatepickerOptions = {
		view?: 'days' | 'months' | 'years';
		minView?: 'days' | 'months' | 'years';
		dateFormat?: string;
		maxDate?: Date | string | number;
	};

	function normalizeMonth(value: string | undefined | null) {
		return value ? value.slice(0, 7) : '';
	}

	const monthPickerOptions: DatepickerOptions = {
		view: 'months',
		minView: 'months',
		dateFormat: 'yyyy-MM',
		maxDate: new Date()
	};

	const datePickerOptions: DatepickerOptions = {
		dateFormat: 'yyyy-MM-dd',
		maxDate: new Date()
	};

	type Header = {
		label: string;
		key: string;
		sort?: boolean;
		isSearchable?: boolean;
		width?: string;
	};

	let headers: Header[] = [];

	$: {
		const headerMonth = startMonth || normalizeMonth(startMonthInput) || toMonthStr(firstOfMonth());
		headers = [
		{ label: 'Klient', key: 'client', sort: true, isSearchable: true },
		{ label: 'PaketId', key: 'packageId', sort: true, isSearchable: true, width: '110px' },
		{ label: 'Fakt.nr', key: 'invoiceNumbers', isSearchable: true },
		{ label: 'Kund (kundnr)', key: 'customer', isSearchable: true },
		{ label: 'Produkt', key: 'product', isSearchable: true },
		{ label: 'Paketets pris', key: 'packagePrice', sort: true },
		{ label: 'Antal pass', key: 'sessions', sort: true },
		{ label: 'Pris per pass', key: 'pricePerSession', sort: true },
		{ label: 'Antal fakturor', key: 'invoiceCount', sort: true },
		{ label: `Antal fakt. t.o.m. ${endDate}`, key: 'invoicesUntilEnd', sort: true },
		{ label: 'Fakturerade pass', key: 'paidSessions', sort: true },
		{ label: 'Fakturerad summa', key: 'paidSum', sort: true },
		{ label: 'Utnyttjade pass', key: 'usedSessions', sort: true },
		{ label: `Utnyttjade pass ${headerMonth}`, key: 'usedSessionsMonth', sort: true },
		{ label: 'Återstående pass', key: 'remainingSessions', sort: true },
		{ label: 'Utnyttjad summa', key: 'usedSum', sort: true },
		{ label: `Utnyttjad summa ${headerMonth}`, key: 'usedSumMonth', sort: true },
		{ label: 'Skuld/fordran i kronor', key: 'balance', sort: true }
		];
	}

	let data: TableType = [];
	let filteredData: TableType = [];
	let searchQuery = '';
	let loading = false;
	let totalBalance = 0;
	let filtersReady = false;

	const USE_MOCK = false;

	type ApiResponse = {
		rows: ApiRow[];
		totalBalance?: number;
	};

	type ApiRow = {
		client: string;
		packageId: number;
		invoiceNumbers: string[];
		customerName: string;
		customerNo?: string | null;
		product: string;
		packagePrice: number;
		sessions: number;
		pricePerSession: number;
		invoiceCount: number; // tot. delbetalningstillfällen (installments)
		invoicesUntilEnd: number; // delbetalningar ≤ end_date
		paidSessions: number; // paid_sum / price_per_session
		paidSum: number; // summa betalt ≤ end_date
		usedSessions: number; // utnyttjade pass ≤ end_date
		usedSessionsMonth: number; // utnyttjade pass i [start_date, end_date]
		remainingSessions: number; // sessions - usedSessions
		usedSum: number; // usedSessions * pricePerSession
		usedSumMonth: number; // usedSessionsMonth * pricePerSession
		balance: number; // paidSum - usedSum
	};

	function mapToTableRow(r: ApiRow) {
		return {
			id: `${r.packageId}-${r.customerNo ?? ''}`,
			client: r.client,
			packageId: r.packageId,
			invoiceNumbers: r.invoiceNumbers.join(', '),
			customer: r.customerNo ? `${r.customerName} (${r.customerNo})` : r.customerName,
			product: r.product,

			// Behåll numeriska typer (Table kan formatera/sortera korrekt)
			packagePrice: r.packagePrice,
			sessions: r.sessions,
			pricePerSession: r.pricePerSession,
			invoiceCount: r.invoiceCount,
			invoicesUntilEnd: r.invoicesUntilEnd,
			paidSessions: r.paidSessions,
			paidSum: r.paidSum,
			usedSessions: r.usedSessions,
			usedSessionsMonth: r.usedSessionsMonth,
			remainingSessions: r.remainingSessions,
			usedSum: r.usedSum,
			usedSumMonth: r.usedSumMonth,
			balance: r.balance
		};
	}

	function includeZeroParam() {
		return includeZeroBalances.value === 'yes' ? '1' : '0';
	}

	function startDateParam() {
		const normalized = startMonth || normalizeMonth(startMonthInput);
		return normalized ? `${normalized}-01` : `${toMonthStr(firstOfMonth())}-01`;
	}

	async function fetchReport() {
		loading = true;
		totalBalance = 0;
		try {
			let rows: ApiRow[] = [];

			if (USE_MOCK) {
				rows = [
					{
						client: 'Anna Andersson',
						packageId: 101,
						invoiceNumbers: ['INV-2001', 'INV-2002'],
						customerName: 'Acme AB',
						customerNo: 'C-001',
						product: '10 pass',
						packagePrice: 6500,
						sessions: 10,
						pricePerSession: 650,
						invoiceCount: 2,
						invoicesUntilEnd: 2,
						paidSessions: 10,
						paidSum: 6500,
						usedSessions: 6,
						usedSessionsMonth: 2,
						remainingSessions: 4,
						usedSum: 3900,
						usedSumMonth: 1300,
						balance: 2600
					},
					{
						client: 'Björn Berg',
						packageId: 102,
						invoiceNumbers: ['INV-2101'],
						customerName: 'Contoso Oy',
						customerNo: 'C-014',
						product: '5 pass',
						packagePrice: 3000,
						sessions: 5,
						pricePerSession: 600,
						invoiceCount: 1,
						invoicesUntilEnd: 1,
						paidSessions: 5,
						paidSum: 3000,
						usedSessions: 5,
						usedSessionsMonth: 1,
						remainingSessions: 0,
						usedSum: 3000,
						usedSumMonth: 600,
						balance: 0
					}
				];
				totalBalance = rows.reduce((acc, r) => acc + (r.balance ?? 0), 0);
			} else {
				const params = new URLSearchParams({
					start_date: startDateParam(),
					end_date: endDate,
					include_zero: includeZeroParam()
				});
				const res = await fetch(`/api/reports/customer-credit-balance?${params.toString()}`);
				if (!res.ok) throw new Error('Misslyckades att hämta rapport');
				const json: ApiResponse = await res.json();
				rows = json?.rows ?? [];
				totalBalance = json?.totalBalance ?? rows.reduce((acc, r) => acc + (r.balance ?? 0), 0);
			}

			data = rows.map(mapToTableRow);
			filteredData = [...data];
		} catch (e) {
			addToast({
				type: 'error',
				title: 'Kunde inte ladda rapporten',
				message: (e as Error).message
			});
			data = [];
			filteredData = [];
			totalBalance = 0;
		} finally {
			loading = false;
		}
	}

	// Enkel fritextsökning
	$: if (data) {
		const q = searchQuery.toLowerCase();
		filteredData = !q
			? [...data]
			: data.filter((row) =>
					headers.some((h) => {
						if (!h.isSearchable) return false;
						const v = row[h.key];
						if (typeof v === 'string') return v.toLowerCase().includes(q);
						if (typeof v === 'number') return v.toString().includes(q);
						return false;
					})
				);
	}

	onMount(() => {
		filtersReady = true;
	});

	$: {
		const normalizedStartMonth = normalizeMonth(startMonthInput);
		if (startMonthInput && startMonthInput !== normalizedStartMonth) {
			startMonthInput = normalizedStartMonth;
		}
		if (startMonth !== normalizedStartMonth) {
			startMonth = normalizedStartMonth;
		}
	}

	$: filterSignature = `${startMonth}|${endDate}|${includeZeroBalances.value}`;
	$: if (filtersReady && filterSignature) {
		fetchReport();
	}

	async function exportExcel() {
		let success = false;
		try {
			const params = new URLSearchParams({
				start_date: startDateParam(),
				end_date: endDate,
				include_zero: includeZeroParam()
			});
			const res = await fetch(`/api/reports/customer-credit-balance/export?${params.toString()}`);
			if (!res.ok) throw new Error('Kunde inte skapa Excel');
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `kunders_tillgodohavande_${endDate}.xlsx`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
			success = true;
		} catch (e) {
			addToast({ type: 'error', title: 'Export misslyckades', message: (e as Error).message });
		} finally {
			if (success) {
				addToast({
					type: 'success',
					title: 'Export slutförd',
					message: 'Excel-filen har skapats.'
				});
			}
		}
	}
</script>

<div class="custom-scrollbar m-4 h-full overflow-x-auto">
	<!-- Titel -->
	<div class="mb-4 flex items-center gap-2">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Charts" size="14px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">Kunders tillgodohavande</h2>
	</div>

	<!-- Filter -->
	<div class="mb-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
		<div class="flex flex-col gap-3">
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="flex flex-col gap-1">
					<span class="text-text/70 text-sm">Månad</span>
					<Datepicker
						bind:value={startMonthInput}
						options={monthPickerOptions}
						placeholder="Välj månad"
					/>
				</label>
				<label class="flex flex-col gap-1">
					<span class="text-text/70 text-sm">Per datum</span>
					<Datepicker bind:value={endDate} options={datePickerOptions} placeholder="Välj datum" />
				</label>
			</div>
			<div class="min-w-0">
				<OptionButton
					options={[
						{ value: 'no', label: 'Dölj nollsaldo' },
						{ value: 'yes', label: 'Visa nollsaldo' }
					]}
					bind:selectedOption={includeZeroBalances}
					size="small"
					full
				/>
			</div>
			<div>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Sök klient, kund, faktura, produkt…"
					class="w-full rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
				/>
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

	<!-- Summering -->
	<div class="text-text/80 mb-3 text-sm">
		<strong>Totalsumma (saldo):</strong>
		{totalBalance.toFixed(2)} kr
	</div>

	<!-- Tabell -->
	{#if loading}
		<div class="text-text/60 py-10">Laddar rapport…</div>
	{:else}
		<Table {headers} data={filteredData} noSelect sideScrollable />
	{/if}
</div>
