<script lang="ts">
	import { onMount } from 'svelte';
	import type { TableType } from '$lib/types/componentTypes';
	import { goto } from '$app/navigation';
	import Button from '../../bits/button/Button.svelte';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import Table from '../../bits/table/Table.svelte';
	import PopupWrapper from '../../ui/popupWrapper/PopupWrapper.svelte';
	import CustomerForm from '../../ui/customerForm/CustomerForm.svelte';
	import { debounce } from '$lib/utils/debounce';
	import { loadingStore } from '$lib/stores/loading';

	let showCustomerModal = false;

	function openCustomerForm() {
		showCustomerModal = true;
	}
	function closeCustomerForm() {
		showCustomerModal = false;
	}

	let data: TableType = [];
	let filteredData: TableType = [];
	let selectedStatusOption = { value: 'active', label: 'Aktiva kunder' };
	let searchQuery = '';
	let debouncedSearch = debounce(() => fetchPaginatedCustomers(true), 300);

	let page = 0;
	let limit = 50;
	let isLoading = false;
	let hasMore = true;
	let sortBy = 'name';
	let sortOrder = 'asc';

	const headers = [
		{ label: 'Kund', key: 'name', icon: 'Person', sort: true, isSearchable: true },
		{ label: 'Kontakt', key: 'contact', isSearchable: true },
		{ label: 'Actions', key: 'actions', isSearchable: false, width: '100px' }
	];

	function onGoToCustomer(id: number) {
		goto(`/settings/customers/${id}`);
	}

	async function handleSortChange(event) {
		const { column, order } = event.detail;
		sortBy = column;
		sortOrder = order;
		await fetchPaginatedCustomers(true);
	}

	async function fetchPaginatedCustomers(reset = false) {
		if (isLoading || (!hasMore && !reset)) return;

		isLoading = true;
		loadingStore.loading(true, 'Hämtar kunder...');

		if (reset) {
			page = 0;
			data = [];
			hasMore = true;
		}

		try {
			const res = await fetch(
				`/api/customers?offset=${page * limit}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}&search=${encodeURIComponent(searchQuery)}`
			);
			if (!res.ok) throw new Error('Failed to fetch customers');

			const fetched = await res.json();

			const newData = fetched.map((cust) => ({
				id: cust.id,
				name: cust.name,
				contact: [
					{ type: 'email', content: cust.email },
					{ type: 'phone', content: cust.phone }
				],
				isActive: cust.active,
				actions: [
					{
						type: 'button',
						label: '',
						icon: 'Person',
						variant: 'secondary',
						action: () => onGoToCustomer(cust.id)
					}
				]
			}));

			data = [...data, ...newData];

			if (newData.length < limit) hasMore = false;
			page++;
		} catch (error) {
			console.error('Error loading customers:', error);
		} finally {
			isLoading = false;
			loadingStore.loading(false);
		}
	}

	onMount(() => {
		fetchPaginatedCustomers(true);
	});

	$: {
		const query = searchQuery.toLowerCase();
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
					return value.some((item) => item.content?.toLowerCase().includes(query));
				}
				return false;
			});
		});
	}

	function handleScroll(event: Event) {
		const el = event.target as HTMLElement;
		if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
			fetchPaginatedCustomers();
		}
	}
</script>

<!-- UI -->
<div class="h-full overflow-x-scroll custom-scrollbar" on:scroll={handleScroll}>
	<div class="my-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<Button text="Lägg till kund" variant="primary" on:click={openCustomerForm} />

		<div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:gap-4">
			<input
				type="text"
				bind:value={searchQuery}
				on:input={debouncedSearch}
				placeholder="Sök kund..."
				class="w-full min-w-60 max-w-md rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
			/>

			<div class="min-w-80">
				<OptionButton
					options={[
						{ value: 'active', label: 'Aktiva kunder' },
						{ value: 'inactive', label: 'Inaktiva kunder' },
						{ value: 'all', label: 'Visa alla' }
					]}
					bind:selectedOption={selectedStatusOption}
					size="small"
				/>
			</div>
		</div>
	</div>

	<Table {headers} data={filteredData} on:sortChange={handleSortChange} />

	{#if isLoading}
		<p class="my-4 text-center text-sm text-gray-400">Laddar fler kunder...</p>
	{/if}

	{#if !hasMore && data.length > 0}
		<p class="my-4 text-center text-sm text-gray-400">Inga fler kunder att visa.</p>
	{/if}
</div>

<!-- Modal for CustomerForm -->
{#if showCustomerModal}
	<PopupWrapper header="Ny kund" icon="Plus" on:close={closeCustomerForm}>
		<CustomerForm
			on:created={() => {
				closeCustomerForm();
				fetchPaginatedCustomers(true);
			}}
		/>
	</PopupWrapper>
{/if}
