<script lang="ts">
	import { onMount } from 'svelte';
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

	let selectedUsers: User[] = [];
	let selectedLocations: Location[] = [];
	let selectedClients: Client[] = [];

	onMount(() => {
		fetchUsers();
		fetchLocations();
		fetchClients();
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

	function onFilter() {
		calendarStore.updateFilters(
			{
				trainerIds: selectedUsers.map((user) => user.id),
				locationIds: selectedLocations.map((location) => location.id),
				clientIds: selectedClients.map((client) => client.id)
			},
			fetch
		);
	}

	// Subscribe to calendarStore to access filters
	$: filters = get(calendarStore).filters;
</script>

<div class="flex h-[600px] w-[400px] flex-col justify-between bg-white p-4">
	<div class="flex flex-col gap-4">
		<!-- Users Dropdown -->
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
			bind:selectedValues={selectedUsers}
			on:change={handleUserSelection}
		/>

		<!-- Locations Dropdown -->
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

		<!-- Clients Dropdown -->
		<DropdownCheckbox
			label="Kunder"
			placeholder="Välj kunder"
			id="clients"
			options={($clients || []).map((client) => ({
				name: `${client.firstname} ${client.lastname}`,
				value: client
			}))}
			maxNumberOfSuggestions={15}
			infiniteScroll={true}
			bind:selectedValues={selectedClients}
			on:change={handleClientSelection}
		/>
	</div>

	<!-- Selected Filters Section -->
	<div class="mt-4">
		<h3 class="text-lg font-semibold">Aktiva filter:</h3>
		<ul class="mt-2 list-disc pl-4 text-sm text-gray-700">
			{#if filters.trainerIds && filters.trainerIds.length > 0}
				<li>
					<strong>Tränare:</strong>
					<p>
						{#each selectedUsers as user, index}
							<span>
								{`${user.firstname} ${user.lastname}${index < selectedUsers.length - 1 ? ', ' : ''}`}
							</span>
						{/each}
					</p>
				</li>
			{/if}

			{#if filters.locationIds && filters.locationIds.length > 0}
				<li>
					<strong>Plats:</strong>
					<p>
						{#each selectedLocations as location, index}
							<span>
								{`${location.name}${index < selectedLocations.length - 1 ? ', ' : ''}`}
							</span>
						{/each}
					</p>
				</li>
			{/if}

			{#if filters.clientIds && filters.clientIds.length > 0}
				<li>
					<strong>Kunder:</strong>
					<p>
						{#each selectedClients as client, index}
							<span>
								{`${client.firstname} ${client.lastname}${index < selectedClients.length - 1 ? ', ' : ''}`}
							</span>
						{/each}
					</p>
				</li>
			{/if}

			{#if filters.from && filters.to}
				<li><strong>Datumintervall:</strong> {filters.from} - {filters.to}</li>
			{/if}

			{#if filters.date}
				<li><strong>Datum:</strong> {filters.date}</li>
			{/if}

			{#if filters.roomId}
				<li><strong>Rum:</strong> {filters.roomId}</li>
			{/if}

			{#if !filters.trainerIds?.length && !filters.locationIds?.length && !filters.clientIds?.length && !filters.from && !filters.to && !filters.date && !filters.roomId}
				<p class="text-gray-500">Inga filter valda</p>
			{/if}
		</ul>
	</div>

	<!-- Filter Button -->
	<div class="mt-4 flex flex-col gap-4">
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
