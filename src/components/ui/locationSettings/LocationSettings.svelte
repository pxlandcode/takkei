<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocations, updateLocation, createLocation } from '$lib/services/api/locationService';
	import type { TableType } from '$lib/types/componentTypes';
	import Button from '../../bits/button/Button.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import Table from '../../bits/table/Table.svelte';
	import LocationPopup from '../../ui/locationPopup/LocationPopup.svelte';
	import { openPopup, closePopup } from '$lib/stores/popupStore';

	let data: TableType = [];
	let filteredData: TableType = [];
	let searchQuery = '';

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
					action: () => openEditLocationPopup(loc)
				}
			]
		}));

		filteredData = [...data];
	}

	async function handleAddLocation(locationData) {
		await createLocation(locationData);
		await loadLocations();
		closePopup();
	}

	async function handleUpdateLocation(locationData) {
		await updateLocation(locationData.id, locationData);
		await loadLocations();
		closePopup();
	}

	function openAddLocationPopup() {
		openPopup({
			header: 'Lägg till plats',
			icon: 'Plus',
			component: LocationPopup,
			maxWidth: '640px',
			props: {
				onSave: handleAddLocation
			}
		});
	}

	function openEditLocationPopup(location) {
		openPopup({
			header: 'Redigera plats',
			icon: 'Edit',
			component: LocationPopup,
			maxWidth: '500px',
			props: {
				location,
				onSave: handleUpdateLocation
			}
		});
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
<div class="custom-scrollbar h-full overflow-x-scroll">
	<div class="mb-4 flex flex-row items-center justify-between">
		<Button text="Lägg till plats" variant="primary" on:click={openAddLocationPopup} />

		<div class="ml-4 flex flex-row gap-4">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Sök plats..."
				class="w-full max-w-md rounded-sm border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
			/>
			<Button icon="Filter" variant="secondary" on:click={() => alert('Filter placeholder')} />
		</div>
	</div>

	<Table {headers} data={filteredData} />

	<!-- Popups handled via global store -->
</div>
