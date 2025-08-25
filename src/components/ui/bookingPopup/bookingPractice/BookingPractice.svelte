<!-- src/lib/components/booking/bookingPractice/BookingPractice.svelte -->
<script lang="ts">
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import SlotTimePicker from '../../../bits/slotTimePicker/SlotTimePicker.svelte';
	import Checkbox from '../../../bits/checkbox/Checkbox.svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import Button from '../../../bits/button/Button.svelte';
	import { user } from '$lib/stores/userStore';
	import { get } from 'svelte/store';

	export let bookingObject: any;
	export let users: { label: string; value: number }[] = [];
	export let locations: { label: string; value: number }[] = [];
	export let selectedIsUnavailable: boolean = false;
	export let repeatedBookings: any[] = [];

	// defaults/flags
	$: if (!bookingObject.trainerId) bookingObject.trainerId = get(user)?.id ?? null;
	$: bookingObject.clientId = null; // no client for Praktiktimme
	$: bookingObject.isTrial = false; // cannot be trial
	$: bookingObject.internalEducation = true; // Praktiktimme flag
	$: bookingObject.repeatWeeks ??= 4;

	async function checkRepeatAvailability() {
		const res = await fetch('/api/bookings/check-repeat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				date: bookingObject.date,
				trainerId: bookingObject.trainerId,
				locationId: bookingObject.locationId,
				time: bookingObject.time,
				repeatWeeks: bookingObject.repeatWeeks,
				// 🔑 extra bits only for Praktiktimme
				checkUsersBusy: true,
				userId: bookingObject.user_id
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
</script>

<div
	class="flex flex-col gap-6 rounded-lg border border-dashed border-gray-bright bg-gray-bright/10 p-6"
>
	<Dropdown
		label="Tränare (handledare)"
		labelIcon="Person"
		placeholder="Välj tränare"
		id="trainer"
		options={users}
		bind:selectedValue={bookingObject.trainerId}
		search
	/>

	<Dropdown
		label="Trainee (användare)"
		labelIcon="Person"
		placeholder="Välj trainee"
		id="trainee"
		options={users}
		bind:selectedValue={bookingObject.user_id}
		search
	/>

	<Dropdown
		label="Plats"
		labelIcon="Building"
		placeholder="Välj plats"
		id="locations"
		options={locations}
		bind:selectedValue={bookingObject.locationId}
	/>

	<SlotTimePicker
		bind:selectedDate={bookingObject.date}
		bind:selectedTime={bookingObject.time}
		trainerId={bookingObject.trainerId}
		locationId={bookingObject.locationId}
		checkUsersBusy={true}
		traineeUserId={bookingObject.user_id}
		on:unavailabilityChange={(e) => (selectedIsUnavailable = e.detail)}
	/>

	<!-- Repeat Booking Section (same UX as training) -->
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
				disabled={!bookingObject.repeatWeeks ||
					!bookingObject.user_id ||
					!bookingObject.trainerId ||
					!bookingObject.locationId}
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
