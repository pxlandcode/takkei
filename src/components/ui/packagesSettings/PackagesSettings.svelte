<script lang="ts">
	import { onMount } from 'svelte';
	import type { ComponentType } from 'svelte';
	import type { TableCellValue, TableType } from '$lib/types/componentTypes';

	import Button from '../../bits/button/Button.svelte';
	import Table from '../../bits/table/Table.svelte';
	import PackagePopup from '../packagePopup/PackagePopup.svelte';
	import { debounce } from '$lib/utils/debounce';
	import { loadingStore } from '$lib/stores/loading';
	import { openPopup, closePopup } from '$lib/stores/popupStore';
	import { goto } from '$app/navigation';

	let data: TableType = [];
	let filteredData: TableType = [];
	let searchQuery = '';
	let debouncedSearch = debounce(() => fetchPaginatedPackages(true), 300);

	let page = 0;
	let limit = 50;
	let isLoading = false;
	let hasMore = true;
	let sortBy = 'product';
	let sortOrder = 'asc';

	type PackagesSortChangeEvent = CustomEvent<{ column: string; order: string }>;
	type PackageListItem = {
		id: number;
		product?: string | null;
		customer?: { id?: number | null; name?: string | null } | null;
		client?: { id?: number | null; firstname?: string | null; lastname?: string | null } | null;
		bookings?: TableCellValue;
		payments?: TableCellValue;
		frozen?: TableCellValue;
	};

	const headers = [
		{ label: 'Produkt', key: 'product', sort: true, isSearchable: true },
		{ label: 'Kund', key: 'customer', sort: true, isSearchable: true },
		{ label: 'Klient', key: 'client', sort: true, isSearchable: true },
		{ label: 'Fryst', key: 'frozen', width: '80px' },
		{ label: '', key: 'actions', width: '100px' }
	];

	async function handleSortChange(event: PackagesSortChangeEvent) {
		const { column, order } = event.detail;
		sortBy = column;
		sortOrder = order;
		await fetchPaginatedPackages(true);
	}

	function onGoToPackage(id: number) {
		void goto(`/settings/packages/${id}`);
	}

	async function handleCreatePackage() {
		closePopup();
		try {
			await fetchPaginatedPackages(true);
		} catch (error) {
			console.error('Error refreshing packages after create:', error);
		}
	}

	function openPackagePopup() {
		openPopup({
			header: 'Lägg till paket',
			icon: 'Plus',
			component: PackagePopup as unknown as ComponentType,
			width: '1000px',
			props: {
				onSave: handleCreatePackage
			}
		});
	}

	async function fetchPaginatedPackages(reset = false) {
		if (isLoading || (!hasMore && !reset)) return;

		isLoading = true;
		loadingStore.loading(true, 'Hämtar paket...');

		if (reset) {
			page = 0;
			data = [];
			hasMore = true;
		}

		try {
			const res = await fetch(
				`/api/packages?offset=${page * limit}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}&search=${encodeURIComponent(searchQuery)}`
			);
			if (!res.ok) throw new Error('Failed to fetch packages');

			const fetched: PackageListItem[] = await res.json();

			const newData: TableType = fetched.map((pkg: PackageListItem) => ({
				id: pkg.id,
				product: [
					{
						type: 'link',
						label: pkg.product || 'Okänd typ',
						action: () => {
							void goto(`/settings/packages/${pkg.id}`);
						}
					}
				],
				customer: pkg.customer?.id
					? [
							{
								type: 'link',
								label: pkg.customer?.name || 'Okänd kund',
								action: () => {
									void goto(`/settings/customers/${pkg.customer?.id}`);
								}
							}
						]
					: [{ type: 'text', content: pkg.customer?.name || 'Okänd kund' }],
				client: pkg.client?.id
					? [
							{
								type: 'link',
								label: `${pkg.client.firstname} ${pkg.client.lastname}`,
								action: () => {
									void goto(`/clients/${pkg.client?.id}`);
								}
							}
						]
					: [{ type: 'text', content: '—' }],
				bookings: pkg.bookings,
				payments: pkg.payments,
				frozen: pkg.frozen,
				actions: [
					{
						type: 'button',
						label: '',
						icon: 'CircleInfo',
						variant: 'primary',
						action: () => onGoToPackage(pkg.id)
					}
				]
			}));

			data = [...data, ...newData];

			if (newData.length < limit) hasMore = false;
			page++;
		} catch (error) {
			console.error('Error loading packages:', error);
		} finally {
			isLoading = false;
			loadingStore.loading(false);
		}
	}

	// Initial mount
	onMount(() => {
		fetchPaginatedPackages(true);
	});

	// Filter logic
	$: {
		const query = searchQuery.toLowerCase();
		filteredData = data.filter((row) => {
			if (!query) return true;

			return headers.some((header) => {
				const value = row[header.key];
				if (header.isSearchable && typeof value === 'string') {
					return value.toLowerCase().includes(query);
				}
				return false;
			});
		});
	}

	function handleScroll(event: Event) {
		const el = event.target as HTMLElement;
		const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100;
		if (nearBottom && hasMore && !isLoading) {
			fetchPaginatedPackages();
		}
	}
</script>

<div class="mb-4 flex flex-row items-center justify-between">
	<h2 class="text-xl font-semibold">Paket</h2>
</div>
<div class="h-full overflow-x-scroll custom-scrollbar" on:scroll={handleScroll}>
	<div class="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<Button text="Lägg till paket" variant="primary" on:click={openPackagePopup} />

		<div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-4">
			<input
				type="text"
				bind:value={searchQuery}
				on:input={debouncedSearch}
				placeholder="Sök paket..."
				class="w-full min-w-60 max-w-md rounded-sm border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
			/>
		</div>
	</div>

	<Table noSelect={true} {headers} data={filteredData} on:sortChange={handleSortChange} />

	{#if isLoading}
		<p class="my-4 text-center text-sm text-gray-400">Laddar fler paket...</p>
	{/if}

	{#if !hasMore && data.length > 0}
		<p class="my-4 text-center text-sm text-gray-400">Inga fler paket att visa.</p>
	{/if}
</div>
