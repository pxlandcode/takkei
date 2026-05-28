<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Table from '../../../bits/table/Table.svelte';
	import type { TableType } from '$lib/types/componentTypes';
	import { debounce } from '$lib/utils/debounce';

	export let defaultSessionsLimit = 5;
	export let action = '/exports/clients-packages-status/download';

	type ApiRow = {
		clientName: string;
		clientId: number;
		remaining: number;
	};

	const headers = [
		{ label: 'Klient', key: 'clientName', sort: true, width: '70%' },
		{ label: 'Återstående träningar', key: 'remaining', sort: true, width: '30%' }
	];

	let sessionsLimit = String(defaultSessionsLimit);
	const pageSize = 50;
	let page = 0;
	let hasMore = true;
	let pendingReset = false;
	let rows: TableType = [];
	let tableData: TableType = [];
	let loading = false;
	let error = '';
	let sentinel: HTMLDivElement | null = null;
	let observer: IntersectionObserver | null = null;
	let sentinelObserved = false;

	function mapToTableRow(row: ApiRow) {
		return {
			clientName: [
				{
					type: 'link',
					label: row.clientName,
					action: () => goto(`/clients/${row.clientId}`)
				}
			],
			remaining: row.remaining
		};
	}

	function buildParams() {
		const params = new URLSearchParams({
			sessions_limit: sessionsLimit,
			limit: String(pageSize),
			offset: String(page * pageSize)
		});

		return params;
	}

	async function fetchRows(reset = false) {
		if (loading) {
			if (reset) pendingReset = true;
			return;
		}

		if (!reset && !hasMore) return;

		loading = true;
		error = '';
		pendingReset = false;

		if (reset) {
			page = 0;
			hasMore = true;
			rows = [];
			tableData = [];
		}

		try {
			const params = buildParams();
			const res = await fetch(`/api/reports/clients-packages-status?${params.toString()}`);
			if (!res.ok) throw new Error('Kunde inte hämta paketförnyelse');

			const json: { rows: ApiRow[]; sessionsLimit: number } = await res.json();
			const mappedRows = json.rows.map(mapToTableRow);
			rows = reset ? mappedRows : [...rows, ...mappedRows];
			tableData = rows;
			page += 1;
			hasMore = json.rows.length === pageSize;
		} catch (err) {
			error = (err as Error).message;
			rows = [];
			tableData = [];
			hasMore = false;
		} finally {
			loading = false;
			if (pendingReset) {
				pendingReset = false;
				fetchRows(true);
			}
		}
	}

	const debouncedFetchRows = debounce(() => fetchRows(true), 300);

	function onLimitInput() {
		debouncedFetchRows();
	}

	export function exportExcel() {
		const params = new URLSearchParams({ sessions_limit: sessionsLimit });
		const link = document.createElement('a');
		link.href = `${action}?${params.toString()}`;
		link.download = 'paketfornyelse.xlsx';
		document.body.appendChild(link);
		link.click();
		link.remove();
	}

	onMount(() => {
		fetchRows(true);

		observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					fetchRows();
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
</script>

<div class="mb-6 w-full sm:max-w-xs">
	<label for="sessions_limit" class="mb-2 block text-sm font-medium text-gray-700">
		Gräns för återstående träningar
	</label>
	<input
		id="sessions_limit"
		name="sessions_limit"
		type="number"
		min="1"
		step="1"
		bind:value={sessionsLimit}
		on:input={onLimitInput}
		class="w-full rounded-sm border border-gray-300 bg-white px-3 py-2 text-black transition-colors duration-150 focus:border-gray-500 focus:outline-hidden"
	/>
</div>

{#if error}
	<p class="text-error mb-4 text-sm">{error}</p>
{:else if loading && tableData.length === 0}
	<p class="text-text/60 mb-4 text-sm">Laddar...</p>
{/if}

{#if tableData.length > 0}
	<Table {headers} data={tableData} />
	<div bind:this={sentinel} class="h-1 w-full"></div>
{:else if !loading && !error}
	<div class="text-text/60 py-10">Inga resultat att visa.</div>
{/if}

{#if loading && tableData.length > 0}
	<p class="text-text/60 py-4 text-center text-sm">Laddar fler rader...</p>
{/if}

{#if !hasMore && tableData.length > 0 && !loading}
	<p class="text-text/60 py-4 text-center text-sm">Inga fler rader att visa.</p>
{/if}
