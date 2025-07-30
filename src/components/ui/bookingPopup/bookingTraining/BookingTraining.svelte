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
	import Checkbox from '../../../bits/checkbox/Checkbox.svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import Button from '../../../bits/button/Button.svelte';

	export let bookingObject: any;
	export let bookingContents: { value: string; label: string }[] = [];
	export let repeatedBookings: any;
	export let selectedIsUnavailable: boolean = false;

	let availableRooms = [];

	// Client scope toggle
	let clientScope = { value: 'trainer', label: 'Tränarens klienter' };
	const clientScopeOptions = [
		{ value: 'trainer', label: 'Tränarens klienter' },
		{ value: 'all', label: 'Alla klienter' }
	];

	let filteredClients = [];

	if (!bookingObject.repeatWeeks) {
		bookingObject.repeatWeeks = 4;
	}

	async function checkRepeatAvailability() {
		const res = await fetch('/api/bookings/check-repeat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				date: bookingObject.date,
				trainerId: bookingObject.trainerId,
				locationId: bookingObject.locationId,
				roomId: bookingObject.roomId,
				time: bookingObject.time,
				repeatWeeks: bookingObject.repeatWeeks
			})
		});

		const data = await res.json();

		if (data.success && data.repeatedBookings) {
			repeatedBookings = data.repeatedBookings.map((week) => ({
				...week,
				selectedTime:
					week.conflict && week.suggestedTimes.length > 0 ? week.suggestedTimes[0] : week.time
			}));
		} else {
			repeatedBookings = [];
		}
	}

	function ignoreConflict(weekNumber: number) {
		repeatedBookings = repeatedBookings.filter((w) => w.week !== weekNumber);
	}

	function resolveConflict(weekNumber: number) {
		repeatedBookings = repeatedBookings.map((w) =>
			w.week === weekNumber ? { ...w, conflict: false } : w
		);
	}

	onMount(async () => {
		if (get(locations).length === 0) await fetchLocations();
		if (get(clients).length === 0) await fetchClients();
		if (get(users).length === 0) await fetchUsers();

		if (!bookingObject.bookingType && bookingContents.length > 0) {
			bookingObject.bookingType = bookingContents[0];
		}
	});

	function formatClient(c) {
		const fullName = `${c.firstname} ${c.lastname}`;
		return {
			value: c.id,
			label: fullName,
			name: fullName
		};
	}

	// Reactive filtered clients list
	$: {
		let newFilteredClients = [];

		if (clientScope?.value === 'all') {
			newFilteredClients = $clients.map(formatClient);
		} else if (clientScope?.value === 'trainer' && bookingObject.trainerId) {
			newFilteredClients = $clients
				.filter(
					(c) =>
						c.primary_trainer_id === bookingObject.trainerId ||
						c.trainer?.id === bookingObject.trainerId
				)
				.map(formatClient);
		}

		// If passed-in clientId isn't in the filtered list, switch to "all"
		if (
			bookingObject.clientId !== null &&
			!newFilteredClients.some((c) => c.value === bookingObject.clientId)
		) {
			clientScope = clientScopeOptions.find((opt) => opt.value === 'all')!;
			newFilteredClients = $clients.map(formatClient); // recalculate as "all"
		}

		filteredClients = newFilteredClients;
	}

	// Auto-assign room if only one available
	$: {
		const selectedLocation = $locations.find((loc) => loc.id === bookingObject.locationId);
		availableRooms = selectedLocation?.rooms ?? [];
		bookingObject.roomId = null;
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
		on:unavailabilityChange={(e) => (selectedIsUnavailable = e.detail)}
	/>

	<!-- Repeat Booking Section -->
	<div class="flex flex-col gap-2">
		<Checkbox
			id="repeat"
			name="repeat"
			bind:checked={bookingObject.repeat}
			label="Upprepa denna bokning"
		/>

		{#if bookingObject.repeat}
			<Input
				label="Antal veckor framåt"
				name="repeatWeeks"
				type="number"
				bind:value={bookingObject.repeatWeeks}
				placeholder="Ex: 4"
				min="1"
				max="52"
			/>

			<Button
				text="Kontrollera"
				iconRight="MultiCheck"
				iconRightSize="16"
				variant="primary"
				full
				on:click={checkRepeatAvailability}
				disabled={!bookingObject.repeatWeeks}
			/>

			{#if repeatedBookings.length > 0}
				<div class="flex flex-col gap-2 rounded border border-gray-300 bg-gray-50 p-4">
					{#if repeatedBookings.filter((b) => b.conflict).length > 0}
						<h3 class="flex items-center justify-between text-lg font-semibold">
							Konflikter
							<span class="text-sm text-gray-600">
								{repeatedBookings.filter((b) => b.conflict).length} konflikter /
								{repeatedBookings.length} veckor
							</span>
						</h3>
					{/if}

					<!-- Show conflicts first -->
					{#each repeatedBookings.filter((b) => b.conflict) as week}
						<div class="mb-2 rounded border border-red bg-red/10 p-3">
							{week.date}, kl {week.selectedTime}
							<div class="mt-2">
								<Dropdown
									label="Välj alternativ tid"
									placeholder="Tillgängliga tider"
									id={`week-${week.week}-time`}
									options={week.suggestedTimes.map((t) => ({ label: t, value: t }))}
									bind:selectedValue={week.selectedTime}
								/>
								<div class="mt-2 flex gap-2">
									<Button
										text="Lös"
										variant="primary"
										small
										on:click={() => resolveConflict(week.week)}
									/>
									<Button
										text="Ignorera"
										variant="secondary"
										small
										on:click={() => ignoreConflict(week.week)}
									/>
								</div>
							</div>
						</div>
					{/each}

					<h3 class="text-lg font-semibold">Bokningar klara att bokas:</h3>
					{#each repeatedBookings.filter((b) => !b.conflict) as week}
						<div class="mb-1 rounded border border-green bg-green-bright/10 p-2">
							{week.date}, kl {week.selectedTime}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
