<!-- src/lib/components/booking/bookingPractice/BookingPractice.svelte -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { calendarStore, getWeekStartAndEnd } from '$lib/stores/calendarStore';
	import { closePopup } from '$lib/stores/popupStore';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import SlotTimePicker from '../../../bits/slotTimePicker/SlotTimePicker.svelte';
	import Checkbox from '../../../bits/checkbox/Checkbox.svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import Button from '../../../bits/button/Button.svelte';
	import { user } from '$lib/stores/userStore';
	import { get } from 'svelte/store';
	import type { CalendarFilters } from '$lib/stores/calendarStore';

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
	kind === 'education'
		? trainerOptions
		: trainerOptions.length > 0
			? trainerOptions
			: users;

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
		repeatedBookings = repeatedBookings.map((w) =>
			w.week === weekNumber ? { ...w, conflict: false } : w
		);
	}

	async function viewAvailability() {
		if (!browser || !canViewAvailability) return;

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

		calendarStore.setNewFilters(filters, fetch);
		closePopup();
		await goto('/calendar');
	}
</script>

<div
	class="border-gray-bright bg-gray-bright/10 flex flex-col gap-6 rounded-lg border border-dashed p-6"
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
				disabled={!bookingObject.repeatWeeks ||
					!bookingObject.trainerId ||
					!bookingObject.locationId ||
					(kind === 'practice' && !bookingObject.user_id)}
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
</div>
