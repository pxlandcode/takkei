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
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { get } from 'svelte/store';
	import FilterBox from '../../bits/filterBox/FilterBox.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import { closePopup } from '$lib/stores/popupStore';

	let filters = get(calendarStore).filters;
	let selectedUsers: User[] = [];
	let selectedLocations: Location[] = [];
	let selectedClients: Client[] = [];

	export let isMobile = false;
	export let isDayView = true;
	export let preferredEntity: 'trainer' | 'location' | 'client' | null = null;

	type EntityKey = 'trainer' | 'location' | 'client';

	let selectedEntity: EntityKey = 'trainer';

	$: $user;
	$: singleFilterMode = isMobile && !isDayView;
	$: entityOptions = [
		{ value: 'trainer' as EntityKey, label: 'Tränare' },
		{ value: 'location' as EntityKey, label: 'Plats' },
		{ value: 'client' as EntityKey, label: 'Kund' }
	];
	$: selectedEntityOption =
		entityOptions.find((option) => option.value === selectedEntity) ?? entityOptions[0];
	$: trainerDropdownOptions = [
		{ label: 'Välj tränare', value: null },
		...(($users || []).map((user) => ({
			label: `${user.firstname} ${user.lastname}`,
			value: user.id
		})) ?? [])
	];
	$: locationDropdownOptions = [
		{ label: 'Välj plats', value: null },
		...(($locations || []).map((location) => ({
			label: location.name,
			value: location.id
		})) ?? [])
	];
	$: clientDropdownOptions = [
		{ label: 'Välj kund', value: null },
		...(($clients || []).map((client) => ({
			label: `${client.firstname} ${client.lastname}`,
			value: client.id
		})) ?? [])
	];
	$: selectedTrainerId = selectedUsers[0]?.id ?? null;
	$: selectedLocationId = selectedLocations[0]?.id ?? null;
	$: selectedClientId = selectedClients[0]?.id ?? null;

	const dispatch = createEventDispatcher();

	onMount(async () => {
		await Promise.all([fetchUsers(), fetchLocations(), fetchClients()]);

		// Pre-fill selected options from store
		selectedUsers = get(users).filter((user) => filters.trainerIds?.includes(user.id));
		selectedLocations = get(locations).filter((location) =>
			filters.locationIds?.includes(location.id)
		);
		selectedClients = get(clients).filter((client) => filters.clientIds?.includes(client.id));

		initializeSingleFilterState();
	});

	function initializeSingleFilterState() {
		if (!singleFilterMode) return;
		const activeFromSelections = getEntityFromSelections();
		const initial =
			activeFromSelections ??
			preferredEntity ??
			(filters.trainerIds?.length ? 'trainer' : null) ??
			(filters.locationIds?.length ? 'location' : null) ??
			(filters.clientIds?.length ? 'client' : null) ??
			'trainer';

		selectedEntity = initial as EntityKey;
		preferredEntity = selectedEntity;
		enforceSingleEntity(selectedEntity);
		notifyPreferredEntity();
	}

	function getEntityFromSelections(): EntityKey | null {
		if (selectedUsers.length > 0) return 'trainer';
		if (selectedLocations.length > 0) return 'location';
		if (selectedClients.length > 0) return 'client';
		return null;
	}

	function enforceSingleEntity(entity: EntityKey) {
		if (!singleFilterMode) return;

		if (entity === 'trainer') {
			if (selectedUsers.length > 1) {
				selectedUsers = selectedUsers.slice(-1);
			}
		} else {
			selectedUsers = [];
		}

		if (entity === 'location') {
			if (selectedLocations.length > 1) {
				selectedLocations = selectedLocations.slice(-1);
			}
		} else {
			selectedLocations = [];
		}

		if (entity === 'client') {
			if (selectedClients.length > 1) {
				selectedClients = selectedClients.slice(-1);
			}
		} else {
			selectedClients = [];
		}
	}

	function notifyPreferredEntity() {
		if (!singleFilterMode) return;
		dispatch('preferredEntityChange', { preferredEntity: selectedEntity });
	}

	function handleUserSelection(event) {
		let updated = [...event.detail.selected];
		if (singleFilterMode) {
			if (selectedEntity !== 'trainer') {
				showRestrictionToast('tränare');
				return;
			}
			updated = updated.slice(-1);
		}
		selectedUsers = updated;
		if (singleFilterMode && updated.length > 0) {
			selectedEntity = 'trainer';
			preferredEntity = selectedEntity;
			enforceSingleEntity(selectedEntity);
			notifyPreferredEntity();
		}
	}

	function handleLocationSelection(event) {
		let updated = [...event.detail.selected];
		if (singleFilterMode) {
			if (selectedEntity !== 'location') {
				showRestrictionToast('plats');
				return;
			}
			updated = updated.slice(-1);
		}
		selectedLocations = updated;
		if (singleFilterMode && updated.length > 0) {
			selectedEntity = 'location';
			preferredEntity = selectedEntity;
			enforceSingleEntity(selectedEntity);
			notifyPreferredEntity();
		}
	}

	function handleClientSelection(event) {
		let updated = [...event.detail.selected];
		if (singleFilterMode) {
			if (selectedEntity !== 'client') {
				showRestrictionToast('kund');
				return;
			}
			updated = updated.slice(-1);
		}
		selectedClients = updated;
		if (singleFilterMode && updated.length > 0) {
			selectedEntity = 'client';
			preferredEntity = selectedEntity;
			enforceSingleEntity(selectedEntity);
			notifyPreferredEntity();
		}
	}

	function handleSingleTrainerChange(event) {
		const value = event.detail.value;
		if (value == null || value === '') {
			selectedUsers = [];
		} else {
			const id = Number(value);
			const allUsers = get(users);
			const match = allUsers.find((u) => u.id === id);
			selectedUsers = match ? [match] : [];
		}
		if (singleFilterMode) {
			if (selectedUsers.length > 0) {
				selectedEntity = 'trainer';
				preferredEntity = selectedEntity;
			}
			enforceSingleEntity(selectedEntity);
			notifyPreferredEntity();
		}
	}

	function handleSingleLocationChange(event) {
		const value = event.detail.value;
		if (value == null || value === '') {
			selectedLocations = [];
		} else {
			const id = Number(value);
			const allLocations = get(locations);
			const match = allLocations.find((l) => l.id === id);
			selectedLocations = match ? [match] : [];
		}
		if (singleFilterMode) {
			if (selectedLocations.length > 0) {
				selectedEntity = 'location';
				preferredEntity = selectedEntity;
			}
			enforceSingleEntity(selectedEntity);
			notifyPreferredEntity();
		}
	}

	function handleSingleClientChange(event) {
		const value = event.detail.value;
		if (value == null || value === '') {
			selectedClients = [];
		} else {
			const id = Number(value);
			const allClients = get(clients);
			const match = allClients.find((c) => c.id === id);
			selectedClients = match ? [match] : [];
		}
		if (singleFilterMode) {
			if (selectedClients.length > 0) {
				selectedEntity = 'client';
				preferredEntity = selectedEntity;
			}
			enforceSingleEntity(selectedEntity);
			notifyPreferredEntity();
		}
	}

	function showRestrictionToast(label: string) {
		addToast({
			type: AppToastType.NOTE,
			message: 'Begränsat filter',
			description: `Byt filtertyp för att välja ${label}.`
		});
	}

	function onSelectAllUsers() {
		if (singleFilterMode && selectedEntity !== 'trainer') {
			showRestrictionToast('flera tränare');
			return;
		}
		selectedUsers = $users;
	}

	function onDeSelectAllUsers() {
		selectedUsers = [];
	}

	function onSelectAllClients() {
		if (singleFilterMode && selectedEntity !== 'client') {
			showRestrictionToast('flera kunder');
			return;
		}
		selectedClients = $clients;
	}

	function onDeSelectAllClients() {
		selectedClients = [];
	}

	function onSelectAllLocations() {
		if (singleFilterMode && selectedEntity !== 'location') {
			showRestrictionToast('flera platser');
			return;
		}
		selectedLocations = $locations;
	}

	function onDeSelectAllLocations() {
		selectedLocations = [];
	}

	function onSelectMe() {
		if (singleFilterMode && selectedEntity !== 'trainer') {
			showRestrictionToast('en tränare');
			return;
		}
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
		if (singleFilterMode && selectedEntity !== 'location') {
			showRestrictionToast('en plats');
			return;
		}
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

	function handleEntitySwitch(value: EntityKey) {
		if (!singleFilterMode) return;
		if (selectedEntity === value) return;
		selectedEntity = value;
		preferredEntity = selectedEntity;
		enforceSingleEntity(selectedEntity);
		notifyPreferredEntity();
	}

	$: if (singleFilterMode) {
		const derived = getEntityFromSelections() ?? preferredEntity ?? 'trainer';
		if (selectedEntity !== derived) {
			selectedEntity = derived as EntityKey;
			preferredEntity = selectedEntity;
			enforceSingleEntity(selectedEntity);
			notifyPreferredEntity();
		} else {
			enforceSingleEntity(selectedEntity);
		}
	}

	// Apply filters only when clicking the button
	function onFilter() {
		if (singleFilterMode) {
			enforceSingleEntity(selectedEntity);
		}

		const trainerIds =
			singleFilterMode && selectedEntity !== 'trainer'
				? []
				: selectedUsers.map((user) => user.id);
		const locationIds =
			singleFilterMode && selectedEntity !== 'location'
				? []
				: selectedLocations.map((location) => location.id);
		const clientIds =
			singleFilterMode && selectedEntity !== 'client'
				? []
				: selectedClients.map((client) => client.id);

	calendarStore.updateFilters(
		{
			trainerIds,
			locationIds,
			clientIds
		},
		fetch
	);

		addToast({
			type: AppToastType.NOTE,
			message: 'Filter uppdaterade',
			description: `Filtrerar bokningar baserat på nya filter. `
		});

		dispatch('applied', {
			preferredEntity: singleFilterMode ? selectedEntity : null
		});
		closePopup();
	}
</script>

<div class="flex max-h-dvh min-h-[450px] w-full max-w-full flex-col bg-white p-4 sm:max-w-[600px]">
	<div class="flex flex-col gap-4">
		{#if singleFilterMode}
			<div class="border-gray-200 bg-gray-50 text-gray flex flex-col gap-3 rounded-sm border p-3 text-sm">
				<p>
					Välj en filtertyp för att visa veckan. Endast en tränare, plats eller kund kan vara aktiv
					åt gången på mobilens veckovy.
				</p>
				<OptionButton
					options={entityOptions}
					selectedOption={selectedEntityOption}
					size="small"
					on:select={(event) => handleEntitySwitch(event.detail as EntityKey)}
				/>
			</div>

			{#if selectedEntity === 'trainer'}
				<div class="flex flex-col gap-2">
					<div class="flex items-end gap-2">
						<div class="flex-1">
							<Dropdown
								id="trainer-single"
								label="Tränare"
								placeholder="Välj tränare"
								options={trainerDropdownOptions}
								selectedValue={selectedTrainerId}
								on:change={handleSingleTrainerChange}
							/>
						</div>
						<Button
							icon="Person"
							iconColor="orange"
							iconSize="16"
							variant="secondary"
							on:click={onSelectMe}
						/>
					</div>
				</div>
			{:else if selectedEntity === 'location'}
				<div class="flex flex-col gap-2">
					<div class="flex items-end gap-2">
						<div class="flex-1">
							<Dropdown
								id="location-single"
								label="Plats"
								placeholder="Välj plats"
								options={locationDropdownOptions}
								selectedValue={selectedLocationId}
								on:change={handleSingleLocationChange}
							/>
						</div>
						<Button
							icon="Building"
							iconColor="orange"
							iconSize="16"
							variant="secondary"
							on:click={onSelectMyPrimaryLocation}
						/>
					</div>
				</div>
			{:else}
				<div class="flex flex-col gap-2">
					<Dropdown
						id="client-single"
						label="Kund"
						placeholder="Välj kund"
						options={clientDropdownOptions}
						selectedValue={selectedClientId}
						on:change={handleSingleClientChange}
						search={true}
						infiniteScroll={true}
						maxNumberOfSuggestions={20}
					/>
				</div>
			{/if}
		{:else}
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
		{/if}
	</div>

	{#if !singleFilterMode}
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
	{/if}

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
