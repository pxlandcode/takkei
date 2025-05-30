<script lang="ts">
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
	import OptionButton from '../../../bits/optionButton/OptionButton.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import { user } from '$lib/stores/userStore';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import { clients, fetchClients } from '$lib/stores/clientsStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import SlotTimePicker from '../../../bits/slotTimePicker/SlotTimePicker.svelte';

	export let bookingObject: any;
	export let bookingContents: { value: string; label: string }[] = [];

	let availableRooms = [];

	// Client scope toggle
	let clientScope = { value: 'trainer', label: 'Tränarens klienter' };
	const clientScopeOptions = [
		{ value: 'trainer', label: 'Tränarens klienter' },
		{ value: 'all', label: 'Alla klienter' }
	];

	let filteredClients = [];

	onMount(async () => {
		if (get(locations).length === 0) await fetchLocations();
		if (get(clients).length === 0) await fetchClients();
		if (get(users).length === 0) await fetchUsers();

		if (!bookingObject.bookingType && bookingContents.length > 0) {
			bookingObject.bookingType = bookingContents[0];
		}
	});

	// Format client to expected shape
	function formatClient(c) {
		const fullName = `${c.firstname} ${c.lastname}`;
		return {
			value: c.id,
			label: fullName,
			name: fullName
		};
	}

	// Reactive filtered clients list
	$: filteredClients = (() => {
		if (clientScope?.value === 'all') {
			return $clients.map(formatClient);
		}
		if (clientScope?.value === 'trainer' && bookingObject.trainerId) {
			return $clients
				.filter(
					(c) =>
						c.primary_trainer_id === bookingObject.trainerId ||
						c.trainer?.id === bookingObject.trainerId
				)
				.map(formatClient);
		}
		return [];
	})();

	// $: filteredClients && console.log('Filtered Clients:', filteredClients);
	// console.log('Client Scope:', clientScope);
	console.log('cients', $clients);
	// console.log('Trainer ID:', bookingObject.trainerId);
	// $: console.log('Booking Object:', bookingObject);
	// console.log('users', $users);

	$: bookingObject && console.log('Booking Object:', bookingObject);
	// Reset client if not found in filtered list
	$: {
		const exists = filteredClients.some((c) => c.value === bookingObject.clientId);
		if (!exists) {
			bookingObject.clientId = null;
		}
	}

	$: locations && console.log('Locations:', $locations);

	// Auto-assign room if only one available
	$: {
		const selectedLocation = $locations.find((loc) => loc.id === bookingObject.locationId);
		if (selectedLocation) {
			availableRooms = selectedLocation.rooms ?? [];
			bookingObject.roomId = availableRooms.length === 1 ? availableRooms[0].id : null;
		} else {
			availableRooms = [];
			bookingObject.roomId = null;
		}
	}

	// Booking type selection handler
	function handleBookingTypeSelection(event: CustomEvent<string>) {
		bookingObject.bookingType = {
			value: event.detail,
			label: capitalizeFirstLetter(event.detail)
		};
	}

	// Auto-assign current user as trainer if not set
	$: if (!bookingObject.trainerId) {
		bookingObject.trainerId = $user.id;
	}

	// Scope switch resets client selection
	function handleClientScopeSelect(event: CustomEvent<string>) {
		const selectedValue = event.detail;
		clientScope =
			clientScopeOptions.find((opt) => opt.value === selectedValue) ?? clientScopeOptions[0];
		bookingObject.clientId = null;
	}
</script>

<div
	class="flex flex-col gap-6 rounded-lg border border-dashed border-gray-bright bg-gray-bright/10 p-6"
>
	<Dropdown
		label="Tränare"
		labelIcon="Person"
		labelIconSize="16px"
		placeholder="Välj tränare"
		id="users"
		options={$users.map((u) => ({ label: `${u.firstname} ${u.lastname}`, value: u.id }))}
		search
		maxNumberOfSuggestions={15}
		infiniteScroll
		bind:selectedValue={bookingObject.trainerId}
	/>

	<!-- Filters -->
	<div class="flex flex-col gap-4">
		<div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
			<OptionButton
				label="Klienter"
				labelIcon="Clients"
				options={clientScopeOptions}
				bind:selectedOption={clientScope}
				size="small"
				on:select={handleClientScopeSelect}
			/>

			<Dropdown
				label="Klient"
				labelIcon="Clients"
				placeholder="Välj klient"
				id="clients"
				options={filteredClients}
				search={filteredClients.length > 6}
				maxNumberOfSuggestions={10}
				infiniteScroll
				bind:selectedValue={bookingObject.clientId}
			/>
		</div>

		<div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
			<Dropdown
				label="Plats"
				placeholder="Välj plats"
				labelIcon="Building"
				labelIconSize="16px"
				id="locations"
				options={$locations.map((loc) => ({ label: loc.name, value: loc.id }))}
				bind:selectedValue={bookingObject.locationId}
			/>

			{#if availableRooms.length > 1}
				<Dropdown
					label="Rum"
					placeholder="Välj rum"
					id="rooms"
					options={availableRooms.map((room) => ({ label: room.name, value: room.id }))}
					bind:selectedValue={bookingObject.roomId}
				/>
			{/if}
		</div>
	</div>

	<OptionButton
		options={bookingContents}
		bind:selectedOption={bookingObject.bookingType}
		size="small"
		on:select={handleBookingTypeSelection}
		full
	/>
	<!-- Date & Time -->
	<SlotTimePicker
		bind:selectedDate={bookingObject.date}
		bind:selectedTime={bookingObject.time}
		trainerId={bookingObject.trainerId}
		locationId={bookingObject.locationId}
		roomId={bookingObject.roomId}
	/>

	<!-- Repeat Booking -->
	<label class="flex items-center gap-2 text-sm font-medium text-gray-700">
		<input type="checkbox" bind:checked={bookingObject.repeat} class="h-4 w-4" />
		Upprepa denna bokning
	</label>
</div>
