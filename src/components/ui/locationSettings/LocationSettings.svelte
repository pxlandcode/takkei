<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocations, updateLocation, createLocation } from '$lib/services/api/locationService';
	import type { TableType } from '$lib/types/componentTypes';
	import Button from '../../bits/button/Button.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import Table from '../../bits/table/Table.svelte';
	import LocationPopup from '../../ui/locationPopup/LocationPopup.svelte';
	import RoomBlocksPopup from '../../ui/roomBlocksPopup/RoomBlocksPopup.svelte';
	import { openPopup, closePopup } from '$lib/stores/popupStore';

	type LocationRecord = {
		id: number;
		name: string;
		color?: string | null;
		rooms?: Array<{
			id: number;
			name: string;
			active: boolean;
			half_hour_start?: boolean;
		}>;
	};

	type LocationFormPayload = {
		id?: number | null;
		name: string;
		color: string;
		rooms?: unknown[];
	};

	let data: TableType = [];
	let filteredData: TableType = [];
	let searchQuery = '';

	const headers = [
		{ label: 'Namn', key: 'name', icon: 'Building', isSearchable: true },

		{ label: 'Actions', key: 'actions', isSearchable: false, width: '150px' }
	];

	onMount(async () => {
		await loadLocations();
	});

	async function loadLocations() {
		const locations = (await getLocations()) as LocationRecord[];

		data = locations.map((loc) => ({
			name: loc.name,
			actions: [
				{
					type: 'button',
					icon: 'CalendarCross',
					label: '',
					variant: 'secondary',
					tooltip: 'Hantera blockeringar',
					action: () => openRoomBlocksPopup(loc)
				},
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

	async function handleAddLocation(locationData: LocationFormPayload) {
		await createLocation(locationData);
		await loadLocations();
		closePopup();
	}

	async function handleUpdateLocation(locationData: LocationFormPayload) {
		if (locationData.id == null) return;
		await updateLocation(locationData.id, locationData);
		await loadLocations();
		closePopup();
	}

	function openAddLocationPopup() {
		openPopup({
			header: 'Lägg till plats',
			icon: 'Plus',
				component: LocationPopup as any,
			maxWidth: '640px',
			props: {
				onSave: handleAddLocation
			}
		});
	}

	function openEditLocationPopup(location: LocationRecord) {
		openPopup({
			header: 'Redigera plats',
			icon: 'Edit',
				component: LocationPopup as any,
			maxWidth: '500px',
			props: {
				location,
				onSave: handleUpdateLocation
			}
		});
	}

	function openRoomBlocksPopup(location: LocationRecord) {
		openPopup({
			header: `Blockeringar: ${location.name}`,
			icon: 'CalendarCross',
				component: RoomBlocksPopup as any,
			maxWidth: '1100px',
			props: {
				location
			}
		});
	}

	$: {
		const query = searchQuery.toLowerCase();
		filteredData = query
			? data.filter((row) =>
					headers.some(
						(header) => {
							const cell = row[header.key];
							return (
								header.isSearchable &&
								typeof cell === 'string' &&
								cell.toLowerCase().includes(query)
							);
						}
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
