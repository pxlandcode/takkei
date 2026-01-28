<!-- src/lib/components/booking/bookingPractice/BookingPractice.svelte -->
<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { calendarStore, getWeekStartAndEnd } from '$lib/stores/calendarStore';
	import { closePopup } from '$lib/stores/popupStore';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import SlotTimePicker from '../../../bits/slotTimePicker/SlotTimePicker.svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import Button from '../../../bits/button/Button.svelte';
	import { user } from '$lib/stores/userStore';
	import { get } from 'svelte/store';
	import type { CalendarFilters } from '$lib/stores/calendarStore';
	import { locations as locationsStore } from '$lib/stores/locationsStore';
	import { users as usersStore } from '$lib/stores/usersStore';
	import { setSelectedSlot } from '$lib/stores/selectedSlotStore';
	import { getCalendarUrl } from '$lib/helpers/calendarHelpers/calendarNavigation';
	import RepeatBookingSection from '../RepeatBookingSection.svelte';
	import RepeatBookingConflictTimePicker from '../RepeatBookingConflictTimePicker.svelte';

	export let kind: 'practice' | 'education' = 'practice'; // NEW
	export let bookingObject: any;
	export let users: { label: string; value: number }[] = [];
	export let trainerOptions: { label: string; value: number }[] = [];
	export let locations: { label: string; value: number }[] = [];
	export let selectedIsUnavailable = false;
	export let repeatedBookings: any[] = [];
	export let isEditing: boolean = false;
	export let errors: Record<string, string> = {};

	// Common defaults
	$: if (!bookingObject.trainerId) bookingObject.trainerId = get(user)?.id ?? null;
	$: bookingObject.clientId = null;
	$: bookingObject.isTrial = false;
	$: bookingObject.repeatWeeks ??= 4;
	$: effectiveTrainerOptions =
		kind === 'education' ? trainerOptions : trainerOptions.length > 0 ? trainerOptions : users;

	$: {
		if (
			effectiveTrainerOptions.length > 0 &&
			!effectiveTrainerOptions.some((option) => option.value === bookingObject.trainerId)
		) {
			bookingObject.trainerId = effectiveTrainerOptions[0].value;
		} else if (kind === 'education' && effectiveTrainerOptions.length === 0) {
			bookingObject.trainerId = null;
		}
	}

	$: canViewAvailability = Boolean(
		bookingObject.trainerId && bookingObject.locationId && bookingObject.user_id
	);

	// Flags per kind
	$: if (kind === 'practice') {
		bookingObject.internalEducation = true;
		bookingObject.education = false;
	} else {
		bookingObject.internalEducation = false;
		bookingObject.education = true;
	}

	async function checkRepeatAvailability() {
		const payload: any = {
			date: bookingObject.date,
			trainerId: bookingObject.trainerId,
			locationId: bookingObject.locationId,
			time: bookingObject.time,
			repeatWeeks: bookingObject.repeatWeeks
		};

		// Only block on trainee conflicts if we actually have one selected
		if (bookingObject.user_id) {
			payload.checkUsersBusy = true;
			payload.userId = bookingObject.user_id;
		}

		const res = await fetch('/api/bookings/check-repeat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		const data = await res.json();
		repeatedBookings = data.success
			? data.repeatedBookings.map((w: any) => ({
					...w,
					selectedTime: w.conflict && w.suggestedTimes.length > 0 ? w.suggestedTimes[0] : w.time
				}))
			: [];
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

	async function viewAvailability() {
		if (!browser || !canViewAvailability) return;

		const trainerOption = effectiveTrainerOptions.find((option) => option.value === bookingObject.trainerId);
		const traineeOption = users.find((option) => option.value === bookingObject.user_id);
		const locationOption = locations.find((option) => option.value === bookingObject.locationId);
		const trainerRecord = $usersStore?.find((candidate) => candidate.id === bookingObject.trainerId);
		const traineeRecord = $usersStore?.find((candidate) => candidate.id === bookingObject.user_id);
		const locationRecord = $locationsStore?.find((loc) => loc.id === bookingObject.locationId);

		const trainerId = bookingObject?.trainerId ?? null;
		const locationId = bookingObject?.locationId ?? null;
		const traineeId = bookingObject?.user_id ?? null;

		setSelectedSlot({
			source: kind === 'education' ? 'education' : 'practice',
			date: bookingObject?.date ?? null,
			time: bookingObject?.time ?? null,
			trainerId: trainerId != null ? Number(trainerId) : null,
			locationId: locationId != null ? Number(locationId) : null,
			traineeId: traineeId != null ? Number(traineeId) : null,
			bookingType: bookingObject?.bookingType ?? null,
			trainerName: trainerRecord
				? `${trainerRecord.firstname} ${trainerRecord.lastname}`.trim()
				: trainerOption?.label ?? null,
			trainerFirstName: trainerRecord?.firstname ?? null,
			trainerLastName: trainerRecord?.lastname ?? null,
			traineeName: traineeRecord
				? `${traineeRecord.firstname} ${traineeRecord.lastname}`.trim()
				: traineeOption?.label ?? null,
			traineeFirstName: traineeRecord?.firstname ?? null,
			traineeLastName: traineeRecord?.lastname ?? null,
			locationName: locationRecord?.name ?? locationOption?.label ?? null,
			locationColor: locationRecord?.color ?? null
		});

		const filters: Partial<CalendarFilters> = {
			trainerIds: bookingObject.trainerId ? [bookingObject.trainerId] : [],
			locationIds: bookingObject.locationId ? [bookingObject.locationId] : [],
			userIds: bookingObject.user_id ? [bookingObject.user_id] : []
		};

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
		label="Tränare (handledare)"
		labelIcon="Person"
		placeholder="Välj tränare"
		id="trainer"
		options={effectiveTrainerOptions}
		bind:selectedValue={bookingObject.trainerId}
		search
		{errors}
	/>

	<Dropdown
		label={kind === 'practice' ? 'Trainee (användare)' : 'Deltagare (valfri)'}
		labelIcon="Person"
		placeholder="Välj användare"
		id="trainee"
		options={users}
		bind:selectedValue={bookingObject.user_id}
		search
		{errors}
	/>

	<div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
		<Dropdown
			label="Plats"
			labelIcon="Building"
			placeholder="Välj plats"
			id="locations"
			options={locations}
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

	<SlotTimePicker
		bind:selectedDate={bookingObject.date}
		bind:selectedTime={bookingObject.time}
		trainerId={bookingObject.trainerId}
		locationId={bookingObject.locationId}
		checkUsersBusy={!!bookingObject.user_id}
		traineeUserId={bookingObject.user_id}
		bookingIdToIgnore={isEditing && bookingObject?.id ? Number(bookingObject.id) : null}
		on:unavailabilityChange={(e) => (selectedIsUnavailable = e.detail)}
		{errors}
		dateField="date"
		timeField="time"
	/>

	<RepeatBookingSection
		bind:repeat={bookingObject.repeat}
		bind:repeatWeeks={bookingObject.repeatWeeks}
		{repeatedBookings}
		label="Upprepa denna bokning"
		checkDisabled={!bookingObject.trainerId ||
			!bookingObject.locationId ||
			(kind === 'practice' && !bookingObject.user_id)}
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
</div>
