<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
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
	import Input from '../../../bits/Input/Input.svelte';
	import Button from '../../../bits/button/Button.svelte';
	import type { CalendarFilters } from '$lib/stores/calendarStore';
	import { setSelectedSlot } from '$lib/stores/selectedSlotStore';
	import { getCalendarUrl } from '$lib/helpers/calendarHelpers/calendarNavigation';
	import RepeatBookingSection from '../RepeatBookingSection.svelte';
	import RepeatBookingConflictTimePicker from '../RepeatBookingConflictTimePicker.svelte';

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
	let trainerOptions = [];

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
	let locationOptions = [];
	let selectedLocationIcons: { icon: string; size?: string }[] = [];
	$: trainerOptions = $users
		.filter((u) => u.active)
		.map((u) => ({ label: `${u.firstname} ${u.lastname}`, value: u.id }));

	if (!bookingObject.repeatWeeks) {
		bookingObject.repeatWeeks = 4;
	}

	async function checkRepeatAvailability() {
		const filterHalfHourTimes = (times?: string[]) =>
			(times ?? []).filter((time) => time.split(':')[1] === '30');
		const res = await fetch('/api/bookings/check-repeat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				date: bookingObject.date,
				trainerId: bookingObject.trainerId,
				locationId: bookingObject.locationId,
				roomId: bookingObject.roomId,
				time: bookingObject.time,
				repeatWeeks: bookingObject.repeatWeeks,
				checkUsersBusy: true,
				clientId: bookingObject.clientId ?? null
			})
		});

		const data = await res.json();

		if (data.success && data.repeatedBookings) {
			repeatedBookings = data.repeatedBookings.map((week) => {
				const suggestedTimes = filterHalfHourTimes(week.suggestedTimes);
				return {
					...week,
					suggestedTimes,
					selectedTime: week.conflict && suggestedTimes.length > 0 ? suggestedTimes[0] : week.time
				};
			});
		} else {
			repeatedBookings = [];
		}
	}

	function ignoreConflict(weekNumber: number) {
		repeatedBookings = repeatedBookings.filter((w) => w.week !== weekNumber);
	}

	function resolveConflict(weekNumber: number) {
		const targetWeek = repeatedBookings.find((w) => w.week === weekNumber);
		if (!targetWeek?.suggestedTimes || targetWeek.suggestedTimes.length === 0) return;
		repeatedBookings = repeatedBookings.map((w) =>
			w.week === weekNumber ? { ...w, conflict: false } : w
		);
	}

	onMount(async () => {
		if (get(locations).length === 0) await fetchLocations();
		if (get(clients).length === 0 && !isTrial) await fetchClients();
		if (get(users).length === 0) await fetchUsers();
	});

	$: if (!bookingObject.bookingType && bookingContents.length > 0) {
		bookingObject.bookingType = bookingContents[0];
	}

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
			if (clientScope?.value !== 'all') {
				clientScope = clientScopeOptions.find((opt) => opt.value === 'all')!;
			}
			newFiltered = base.map(formatClient);
		}

		filteredClients = newFiltered;
	}

	$: {
		const selectedTrainerId = Number.isFinite(Number(bookingObject.trainerId ?? NaN))
			? Number(bookingObject.trainerId)
			: null;
		const trainer = $users.find((u) => Number(u.id) === selectedTrainerId);
		const allClients = isTrial ? eligibleTrialClients : $clients;
		const selectedClientId =
			bookingObject.clientId === null || bookingObject.clientId === undefined
				? null
				: Number(bookingObject.clientId);
		const clientRecord = allClients.find((c) => Number(c.id) === selectedClientId);

		const trainerDefaultLocationId = Number.isFinite(
			Number(trainer?.default_location_id ?? NaN)
		)
			? Number(trainer?.default_location_id)
			: null;
		const clientPrimaryLocationId = Number.isFinite(
			Number(clientRecord?.primary_location_id ?? NaN)
		)
			? Number(clientRecord?.primary_location_id)
			: null;

		locationOptions = $locations.map((loc) => {
			const locId = Number(loc.id);
			const icons: { icon: string; size?: string }[] = [];
			const isTrainerDefault = trainer && trainerDefaultLocationId !== null && trainerDefaultLocationId === locId;
			const isClientPrimary = clientRecord && clientPrimaryLocationId !== null && clientPrimaryLocationId === locId;

			if (isClientPrimary) icons.push({ icon: 'Clients', size: '19px' });
			if (isTrainerDefault) icons.push({ icon: 'Person', size: '14px' });

			return {
				label: loc.name,
				value: locId,
				icons
			};
		});

		const selectedLocation = locationOptions.find(
			(opt) => Number(opt.value) === Number(bookingObject.locationId ?? NaN)
		);
		selectedLocationIcons = selectedLocation?.icons ?? [];
	}

	// If no location is chosen, fall back to the client's primary location (when available)
	$: {
		const allClients = isTrial ? eligibleTrialClients : $clients;
		const selectedClient = allClients.find((c) => c.id === bookingObject.clientId);
		if (!bookingObject.locationId && selectedClient?.primary_location_id) {
			bookingObject.locationId = selectedClient.primary_location_id;
		}
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

		const currentPath = get(page).url.pathname;
		if (currentPath !== '/calendar') {
			const targetUrl = getCalendarUrl(filters);
			goto(targetUrl);
		}
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
		options={trainerOptions}
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
				options={locationOptions}
				bind:selectedValue={bookingObject.locationId}
				selectedIcons={selectedLocationIcons}
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
		<RepeatBookingSection
			bind:repeat={bookingObject.repeat}
			bind:repeatWeeks={bookingObject.repeatWeeks}
			{repeatedBookings}
			label="Upprepa denna bokning"
			weeksPlaceholder="Ex: 4"
			on:check={checkRepeatAvailability}
		>
			<svelte:fragment slot="conflict" let:week>
				<RepeatBookingConflictTimePicker
					{week}
					onResolve={resolveConflict}
					onIgnore={ignoreConflict}
				/>
			</svelte:fragment>

			<div slot="ready" let:week class="border-green bg-green-bright/10 mb-1 rounded-sm border p-2">
				{week.date}, kl {week.selectedTime}
			</div>
		</RepeatBookingSection>
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
