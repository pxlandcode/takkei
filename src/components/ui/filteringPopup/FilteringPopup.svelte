<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import { clients, fetchClients } from '$lib/stores/clientsStore';
	import type { User } from '$lib/types/userTypes';
	import type { Location } from '$lib/stores/locationsStore';
	import type { Client } from '$lib/stores/clientsStore';
	import DropdownCheckbox from '../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { get } from 'svelte/store';
	import FilterBox from '../../bits/filterBox/FilterBox.svelte';

	// Reactive stores
	let filters = get(calendarStore).filters;
	let selectedUsers: User[] = [];
	let selectedLocations: Location[] = [];
	let selectedClients: Client[] = [];

	const dispatch = createEventDispatcher();

	// Fetch initial data & set selected filters
	onMount(async () => {
		await Promise.all([fetchUsers(), fetchLocations(), fetchClients()]);

		// Pre-fill selected options from store
		selectedUsers = get(users).filter((user) => filters.trainerIds?.includes(user.id));
		selectedLocations = get(locations).filter((location) =>
			filters.locationIds?.includes(location.id)
		);
		selectedClients = get(clients).filter((client) => filters.clientIds?.includes(client.id));
	});

	// Handle selection updates
	function handleUserSelection(event) {
		selectedUsers = [...event.detail.selected];
	}

	function handleLocationSelection(event) {
		selectedLocations = [...event.detail.selected];
	}

	function handleClientSelection(event) {
		selectedClients = [...event.detail.selected];
	}

	function onSelectAllUsers() {
		selectedUsers = $users;
	}

	function onDeSelectAllUsers() {
		selectedUsers = [];
	}

	function onSelectAllClients() {
		selectedClients = $clients;
	}

	function onDeSelectAllClients() {
		selectedClients = [];
	}

	function onSelectAllLocations() {
		selectedLocations = $locations;
	}

	function onDeSelectAllLocations() {
		selectedLocations = [];
	}

	function onClose() {
		dispatch('close');
	}

	// Apply filters only when clicking the button
	function onFilter() {
		calendarStore.updateFilters(
			{
				trainerIds: selectedUsers.map((user) => user.id),
				locationIds: selectedLocations.map((location) => location.id),
				clientIds: selectedClients.map((client) => client.id)
			},
			fetch
		);
		onClose();
	}
</script>

<!-- UI Layout -->
<div class="flex max-h-dvh min-h-[450px] w-[600px] flex-col bg-white p-4">
	<div class="flex flex-col gap-4">
		<!-- Trainers Dropdown -->
		<div class="flex flex-row gap-2">
			<DropdownCheckbox
				label="Tränare"
				placeholder="Välj tränare"
				id="users"
				options={($users || []).map((user) => ({
					name: `${user.firstname} ${user.lastname}`,
					value: user
				}))}
				maxNumberOfSuggestions={15}
				infiniteScroll={true}
				search
				bind:selectedValues={selectedUsers}
				on:change={handleUserSelection}
			/>
			<div class="mt-6 flex flex-row gap-2">
				<Button
					icon="MultiCheck"
					variant="secondary"
					on:click={onSelectAllUsers}
					iconColor="green"
				/>

				<Button icon="Trash" iconColor="red" variant="secondary" on:click={onDeSelectAllUsers} />
			</div>
		</div>

		<div class="flex flex-row gap-2">
			<DropdownCheckbox
				label="Kunder"
				placeholder="Välj kunder"
				id="clients"
				options={($clients || []).map((client) => ({
					name: `${client.firstname} ${client.lastname}`,
					value: client
				}))}
				search
				maxNumberOfSuggestions={15}
				infiniteScroll={true}
				bind:selectedValues={selectedClients}
				on:change={handleClientSelection}
			/>

			<div class="mt-6 flex flex-row gap-2">
				<Button
					icon="MultiCheck"
					variant="secondary"
					on:click={onSelectAllClients}
					iconColor="green"
				/>

				<Button icon="Trash" iconColor="red" variant="secondary" on:click={onDeSelectAllClients} />
			</div>
		</div>

		<!-- Locations Dropdown -->

		<div class="flex flex-row gap-2">
			<DropdownCheckbox
				label="Plats"
				placeholder="Välj plats"
				id="locations"
				options={($locations || []).map((location) => ({
					name: location.name,
					value: location
				}))}
				maxNumberOfSuggestions={15}
				infiniteScroll={true}
				bind:selectedValues={selectedLocations}
				on:change={handleLocationSelection}
			/>

			<div class="mt-6 flex flex-row gap-2">
				<Button
					icon="MultiCheck"
					variant="secondary"
					on:click={onSelectAllLocations}
					iconColor="green"
				/>

				<Button
					icon="Trash"
					iconColor="red"
					variant="secondary"
					on:click={onDeSelectAllLocations}
				/>
			</div>
		</div>
	</div>

	<!-- Filter Box (Shows selected filters immediately) -->
	<div class="mt-4">
		<FilterBox
			{selectedUsers}
			{selectedLocations}
			{selectedClients}
			on:removeFilter={(event) => {
				const { type, id } = event.detail;
				if (type === 'trainer') selectedUsers = selectedUsers.filter((u) => u.id !== id);
				if (type === 'location') selectedLocations = selectedLocations.filter((l) => l.id !== id);
				if (type === 'client') selectedClients = selectedClients.filter((c) => c.id !== id);
			}}
		/>
	</div>

	<div class="mt-auto flex flex-col gap-4">
		<Button
			full
			variant="primary"
			text="Filtrera"
			iconLeft="Filter"
			iconLeftSize="16px"
			on:click={onFilter}
		/>
	</div>
</div>
