<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocations, updateLocation, createLocation } from '$lib/services/api/locationService';
	import type { TableType } from '$lib/types/componentTypes';
	import Button from '../../bits/button/Button.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import Table from '../../bits/table/Table.svelte';
	import PopupWrapper from '../../ui/popupWrapper/PopupWrapper.svelte';
	import LocationPopup from '../../ui/locationPopup/LocationPopup.svelte';

	let data: TableType = [];
	let filteredData: TableType = [];
	let searchQuery = '';

	let showAddModal = false;
	let showEditModal = false;
	let selectedLocation = null;

	const headers = [
		{ label: 'Namn', key: 'name', icon: 'Building', isSearchable: true },

		{ label: 'Actions', key: 'actions', isSearchable: false, width: '100px' }
	];

	onMount(async () => {
		await loadLocations();
	});

	async function loadLocations() {
		const locations = await getLocations();

		data = locations.map((loc) => ({
			name: loc.name,
			actions: [
				{
					type: 'button',
					icon: 'Edit',
					label: '',
					variant: 'secondary',
					action: () => {
						selectedLocation = loc;
						showEditModal = true;
					}
				}
			]
		}));

		filteredData = [...data];
	}

	async function handleAddLocation(locationData) {
		await createLocation(locationData);
		await loadLocations();
		showAddModal = false;
	}

	async function handleUpdateLocation(locationData) {
		await updateLocation(locationData.id, locationData);
		await loadLocations();
		showEditModal = false;
		selectedLocation = null;
	}

	function closePopup() {
		showAddModal = false;
		showEditModal = false;
		selectedLocation = null;
	}

	$: {
		const query = searchQuery.toLowerCase();
		filteredData = query
			? data.filter((row) =>
					headers.some(
						(header) =>
							header.isSearchable &&
							typeof row[header.key] === 'string' &&
							row[header.key].toLowerCase().includes(query)
					)
				)
			: data;
	}
</script>

<div class="mb-4 flex flex-row items-center justify-between">
	<h2 class="text-xl font-semibold">Lokaler</h2>
</div>
<div class="h-full overflow-x-scroll custom-scrollbar">
	<div class="mb-4 flex flex-row items-center justify-between">
		<Button text="Lägg till plats" variant="primary" on:click={() => (showAddModal = true)} />

		<div class="ml-4 flex flex-row gap-4">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Sök plats..."
				class="w-full max-w-md rounded-lg border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
			/>
			<Button icon="Filter" variant="secondary" on:click={() => alert('Filter placeholder')} />
		</div>
	</div>

	<Table {headers} data={filteredData} />

	{#if showAddModal}
		<PopupWrapper header="Lägg till plats" icon="Plus" on:close={closePopup}>
			<LocationPopup onSave={handleAddLocation} />
		</PopupWrapper>
	{/if}

	{#if showEditModal && selectedLocation}
		<PopupWrapper header="Redigera plats" icon="Edit" on:close={closePopup}>
			<LocationPopup location={selectedLocation} onSave={handleUpdateLocation} />
		</PopupWrapper>
	{/if}
</div>
