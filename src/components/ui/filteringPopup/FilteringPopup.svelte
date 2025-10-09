<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { user } from '$lib/stores/userStore';
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
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	let filters = get(calendarStore).filters;
	let selectedUsers: User[] = [];
	let selectedLocations: Location[] = [];
	let selectedClients: Client[] = [];

	$: $user;

	const dispatch = createEventDispatcher();

	onMount(async () => {
		await Promise.all([fetchUsers(), fetchLocations(), fetchClients()]);

		// Pre-fill selected options from store
		selectedUsers = get(users).filter((user) => filters.trainerIds?.includes(user.id));
		selectedLocations = get(locations).filter((location) =>
			filters.locationIds?.includes(location.id)
		);
		selectedClients = get(clients).filter((client) => filters.clientIds?.includes(client.id));
	});

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

	function onSelectMe() {
		const allUsers = get(users);
		const currentUser = allUsers.find((u) => u.id === get(user)?.id);

		if (currentUser) {
			selectedUsers = [currentUser];
		} else {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid val av dig själv',
				description: 'Kunde inte hitta aktuell användare.'
			});
		}
	}

	function onSelectMyPrimaryLocation() {
		const allLocations = get(locations);
		const currentUser = get(user);

		const primaryLocation = allLocations.find((l) => l.id === currentUser?.default_location_id);
		if (primaryLocation) {
			selectedLocations = [primaryLocation];
		} else {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid val av din primära plats',
				description: 'Kunde inte hitta aktuell primära plats.'
			});
		}
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
				clientIds: selectedClients.map((client) => client.id),
				personalBookings: selectedUsers.length === 1
			},
			fetch
		);

		addToast({
			type: AppToastType.NOTE,
			message: 'Filter uppdaterade',
			description: `Filtrerar bokningar baserat på nya filter. `
		});
		onClose();
	}
</script>

<div class="flex max-h-dvh min-h-[450px] w-full max-w-full flex-col bg-white p-4 sm:max-w-[600px]">
	<div class="flex flex-col gap-4">
		<div class="flex flex-col gap-2 sm:flex-row">
			<div class="flex-1">
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
			</div>
			<div class="mt-4 flex flex-wrap gap-2 sm:mt-7 sm:flex-nowrap">
				<Button
					icon="Person"
					iconColor="orange"
					iconSize="16"
					variant="secondary"
					on:click={onSelectMe}
				/>
				<Button
					icon="MultiCheck"
					variant="secondary"
					on:click={onSelectAllUsers}
					iconColor="green"
				/>

				<Button icon="Trash" iconColor="error" variant="secondary" on:click={onDeSelectAllUsers} />
			</div>
		</div>

		<div class="flex flex-col gap-2 sm:flex-row">
			<div class="flex-1">
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
			</div>

			<div class="mt-4 flex flex-wrap gap-2 sm:mt-7 sm:flex-nowrap">
				<Button
					icon="Building"
					iconColor="orange"
					iconSize="16"
					variant="secondary"
					on:click={onSelectMyPrimaryLocation}
				/>
				<Button
					icon="MultiCheck"
					variant="secondary"
					on:click={onSelectAllLocations}
					iconColor="green"
				/>

				<Button
					icon="Trash"
					iconColor="error"
					variant="secondary"
					on:click={onDeSelectAllLocations}
				/>
			</div>
		</div>
	</div>

	<div class="flex flex-col gap-2 sm:flex-row">
		<div class="flex-1">
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
		</div>

		<div class="mt-4 flex flex-wrap gap-2 sm:mt-7 sm:flex-nowrap">
			<Button
				icon="MultiCheck"
				variant="secondary"
				on:click={onSelectAllClients}
				iconColor="green"
			/>

			<Button icon="Trash" iconColor="error" variant="secondary" on:click={onDeSelectAllClients} />
		</div>
	</div>

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
