<script lang="ts">
	import { browser } from '$app/environment';
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
import { calendarStore, getWeekStartAndEnd } from '$lib/stores/calendarStore';
import { closePopup } from '$lib/stores/popupStore';
import OptionButton from '../../../bits/optionButton/OptionButton.svelte';
import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
import { user } from '$lib/stores/userStore';
import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import { clients, fetchClients, fetchTrialEligibleClients } from '$lib/stores/clientsStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import SlotTimePicker from '../../../bits/slotTimePicker/SlotTimePicker.svelte';
	import Checkbox from '../../../bits/checkbox/Checkbox.svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import Button from '../../../bits/button/Button.svelte';
import type { CalendarFilters } from '$lib/stores/calendarStore';
import { setSelectedSlot } from '$lib/stores/selectedSlotStore';

	export let bookingObject: any;
	export let bookingContents: { value: string; label: string }[] = [];
	export let repeatedBookings: any;
	export let selectedIsUnavailable: boolean = false;
	export let isTrial: boolean = false;
	export let isFlight: boolean = false;
	export let isEditing: boolean = false;
	export let errors: Record<string, string> = {};

	let availableRooms = [];
	let eligibleTrialClients = [];

	// Client scope toggle
	let clientScope = { value: 'trainer', label: 'Tränarens klienter' };
	const clientScopeOptions = [
		{ value: 'trainer', label: 'Tränarens klienter' },
		{ value: 'all', label: 'Alla klienter' }
	];

	$: if (isTrial) {
		bookingObject.repeat = false;
		bookingObject.isTrial = true;
		bookingObject.internal = false;
		repeatedBookings = [];
	} else {
		bookingObject.isTrial = false;
	}

	$: if (isFlight) {
		bookingObject.repeat = false;
		bookingObject.isTrial = false;
		bookingObject.internal = true;
		repeatedBookings = [];
	} else {
		bookingObject.internal = bookingObject.internal ?? false;
	}

	$: if (isTrial) {
		const tid = bookingObject.trainerId || undefined;
		fetchTrialEligibleClients({ trainerId: tid, lookbackDays: 365, short: true })
			.then((list) => {
				eligibleTrialClients = list;
			})
			.catch((e) => {
				console.error('Trial clients fetch failed', e);
				eligibleTrialClients = [];
			});
	} else {
		eligibleTrialClients = [];
	}

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
		if (get(clients).length === 0 && !isTrial) await fetchClients();
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

	$: {
		let base = isTrial ? eligibleTrialClients : $clients;
		let newFiltered = [];

		if (clientScope?.value === 'all') {
			newFiltered = base.map(formatClient);
		} else if (clientScope?.value === 'trainer' && bookingObject.trainerId) {
			newFiltered = base
				.filter(
					(c) =>
						c.trainer?.id === bookingObject.trainerId ||
						c.primary_trainer_id === bookingObject.trainerId
				)
				.map(formatClient);
		}

		if (
			bookingObject.clientId !== null &&
			!newFiltered.some((c) => c.value === bookingObject.clientId)
		) {
			clientScope = clientScopeOptions.find((opt) => opt.value === 'all')!;
			newFiltered = base.map(formatClient);
		}

		filteredClients = newFiltered;

		console.log(filteredClients);
	}

	let previousLocationId: number | null = null;

	$: requiresClient = !isFlight;
	$: canViewAvailability = Boolean(
		bookingObject.trainerId &&
			bookingObject.locationId &&
			(!requiresClient || bookingObject.clientId)
	);

	// Auto-assign room if only one available
	$: {
		const selectedLocation = $locations.find((loc) => loc.id === bookingObject.locationId);
		availableRooms = selectedLocation?.rooms ?? [];

		const locationChanged = bookingObject.locationId !== previousLocationId;

		if (!isEditing || locationChanged) {
			if (availableRooms.length === 1) {
				bookingObject.roomId = availableRooms[0].id;
			} else if (!isEditing) {
				bookingObject.roomId = null;
			}
		} else if (
			bookingObject.roomId &&
			!availableRooms.some((room) => room.id === bookingObject.roomId)
		) {
			bookingObject.roomId = availableRooms.length === 1 ? availableRooms[0].id : null;
		}

		previousLocationId = bookingObject.locationId ?? null;
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

	function handleEmailBehaviorSelect(event: CustomEvent<string>) {
		bookingObject.emailBehavior = {
			value: event.detail,
			label: capitalizeFirstLetter(event.detail)
		};
	}

	async function viewAvailability() {
		if (!browser || !canViewAvailability) return;

		const trainer = $users.find((u) => u.id === bookingObject?.trainerId);
		const allClients = isTrial ? eligibleTrialClients : $clients;
		const clientRecord = allClients.find((c) => c.id === bookingObject?.clientId);
		const client = filteredClients.find((c) => c.value === bookingObject?.clientId);
		const location = $locations.find((loc) => loc.id === bookingObject?.locationId);

		const trainerId = bookingObject?.trainerId ?? null;
		const locationId = bookingObject?.locationId ?? null;
		const clientId = bookingObject?.clientId ?? null;

		setSelectedSlot({
			source: isFlight ? 'flight' : isTrial ? 'trial' : 'training',
			date: bookingObject?.date ?? null,
			time: bookingObject?.time ?? null,
			trainerId: trainerId != null ? Number(trainerId) : null,
			locationId: locationId != null ? Number(locationId) : null,
			clientId: clientId != null ? Number(clientId) : null,
			bookingType: bookingObject?.bookingType ?? null,
			trainerName: trainer ? `${trainer.firstname} ${trainer.lastname}` : null,
			trainerFirstName: trainer?.firstname ?? null,
			trainerLastName: trainer?.lastname ?? null,
			clientName: client?.label ?? null,
			clientFirstName: clientRecord?.firstname ?? null,
			clientLastName: clientRecord?.lastname ?? null,
			locationName: location?.name ?? null,
			locationColor: location?.color ?? null
		});

		const filters: Partial<CalendarFilters> = {
			trainerIds: bookingObject.trainerId ? [bookingObject.trainerId] : [],
			locationIds: bookingObject.locationId ? [bookingObject.locationId] : []
		};

		if (requiresClient && bookingObject.clientId) {
			filters.clientIds = [bookingObject.clientId];
		}

		const dateStr: string | null = bookingObject?.date ?? null;
		if (dateStr) {
			const { weekStart, weekEnd } = getWeekStartAndEnd(new Date(`${dateStr}T00:00:00`));
			filters.date = dateStr;
			filters.from = weekStart;
			filters.to = weekEnd;
		}

		// Update filters first, then close popup to avoid timing issues
		await calendarStore.setNewFilters(filters, fetch);
		closePopup();
	}
</script>

<div
	class="border-gray-bright bg-gray-bright/10 flex flex-col gap-6 rounded-sm border border-dashed p-6"
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
		{errors}
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
				{errors}
			/>
		</div>

		<div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
			<Dropdown
				label="Plats"
				placeholder="Välj plats"
				labelIcon="Building"
				labelIconSize="16px"
				id="locations"
				options={$locations.map((loc) => ({ label: loc.name, value: loc.id }))}
				bind:selectedValue={bookingObject.locationId}
				{errors}
			/>
			<div class="flex items-center xl:justify-end">
				<Button
					text="Visa tillgänglighet"
					iconLeft="Calendar"
					iconLeftSize="16px"
					variant="secondary"
					on:click={viewAvailability}
					disabled={!canViewAvailability}
				/>
			</div>
		</div>
	</div>

	<OptionButton
		options={bookingContents}
		bind:selectedOption={bookingObject.bookingType}
		size="small"
		on:select={handleBookingTypeSelection}
		full
		id="bookingType"
		errorKey="bookingType"
		{errors}
	/>
	<!-- Date & Time -->
	<SlotTimePicker
		bind:selectedDate={bookingObject.date}
		bind:selectedTime={bookingObject.time}
		trainerId={bookingObject.trainerId}
		locationId={bookingObject.locationId}
		bookingIdToIgnore={isEditing && bookingObject?.id ? Number(bookingObject.id) : null}
		on:unavailabilityChange={(e) => (selectedIsUnavailable = e.detail)}
		{errors}
		dateField="date"
		timeField="time"
	/>

	<!-- Repeat Booking Section -->
	{#if !isTrial && !isFlight}
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
					<div class="flex flex-col gap-2 rounded-sm border border-gray-300 bg-gray-50 p-4">
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
							<div class="border-red bg-red/10 mb-2 rounded-sm border p-3">
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
							<div class="border-green bg-green-bright/10 mb-1 rounded-sm border p-2">
								{week.date}, kl {week.selectedTime}
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
	<OptionButton
		label="Bekräftelsemail"
		labelIcon="Mail"
		options={[
			{ value: 'none', label: 'Skicka inte' },
			{ value: 'send', label: 'Skicka direkt' },
			{ value: 'edit', label: 'Redigera innan' }
		]}
		bind:selectedOption={bookingObject.emailBehavior}
		on:select={handleEmailBehaviorSelect}
		size="small"
		full
	/>
</div>
