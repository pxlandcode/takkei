<script lang="ts">
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';

	import Input from '../../../bits/Input/Input.svelte';
	import TextArea from '../../../bits/textarea/TextArea.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import Button from '../../../bits/button/Button.svelte';
	import RepeatBookingSection from '../RepeatBookingSection.svelte';

	export let bookingObject: any;
	export let locations: { label: string; value: string }[] = [];
	export let errors: Record<string, string> = {};
	export let repeatedBookings: any[] = [];

	if (!bookingObject.repeatWeeks) {
		bookingObject.repeatWeeks = 4;
	}

	onMount(() => {
		const currentUser = get(user);
		bookingObject.user_id = currentUser?.id;
		bookingObject.attendees = [currentUser?.id];
		bookingObject.user_ids = [currentUser?.id];
	});

	async function checkRepeatAvailability() {
		const res = await fetch('/api/bookings/check-repeat-meeting', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				date: bookingObject.date,
				time: bookingObject.time,
				endTime: bookingObject.endTime,
				user_ids: bookingObject.user_ids,
				repeatWeeks: bookingObject.repeatWeeks
			})
		});

		const data = await res.json();

		if (data.success && data.repeatedBookings) {
			repeatedBookings = data.repeatedBookings.map((week) => {
				return {
					...week,
					selectedTime:
						week.conflict && week.suggestedTimes.length > 0 ? week.suggestedTimes[0] : week.time
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
</script>

<div
	class="border-gray-bright bg-gray-bright/10 flex flex-col gap-6 rounded-sm border border-dashed p-6"
>
	<!-- Name -->
	<Input
		label="Namn"
		name="name"
		type="text"
		placeholder="Ange namn på bokningen"
		bind:value={bookingObject.name}
		{errors}
	/>

	<!-- Description -->
	<TextArea
		label="Beskrivning"
		name="text"
		placeholder="Lägg till en beskrivning..."
		bind:value={bookingObject.text}
		{errors}
	/>

	<!-- Location -->
	<Dropdown
		label="Plats"
		placeholder="Välj plats"
		id="locations"
		options={locations}
		bind:selectedValue={bookingObject.locationId}
	/>

	<!-- Date & Time -->
	<div class="grid grid-cols-2 gap-4">
		<div>
			<label class="text-gray text-sm font-medium" for="date">Datum</label>
			<input
				type="date"
				id="date"
				bind:value={bookingObject.date}
				class="text-gray0 w-full rounded-sm border p-2"
			/>
		</div>
		<div>
			<label class="text-gray text-sm font-medium" for="time">Starttid</label>
			<input
				type="time"
				id="time"
				bind:value={bookingObject.time}
				class="text-gray w-full rounded-sm border p-2"
			/>
		</div>
		<div>
			<label class="text-gray text-sm font-medium" for="endTime">Sluttid</label>
			<input
				type="time"
				id="endTime"
				bind:value={bookingObject.endTime}
				class="text-gray w-full rounded-sm border p-2"
			/>
		</div>
	</div>

	<!-- Repeat -->
	<RepeatBookingSection
		checkboxVariant="native"
		label="Upprepa denna bokning"
		labelClass="flex items-center gap-2 text-sm font-medium text-gray-700"
		bind:repeat={bookingObject.repeat}
		bind:repeatWeeks={bookingObject.repeatWeeks}
		{repeatedBookings}
		weeksPlaceholder="Ex: 4"
		on:check={checkRepeatAvailability}
	>
		<div slot="conflict" let:week class="border-red bg-red/10 mb-2 rounded-sm border p-3">
			<div class="flex flex-col gap-1">
				<span class="font-semibold">
					{week.date}, kl {week.selectedTime}
				</span>

				{#if week.suggestedTimes?.length > 0}
					<Dropdown
						label="Välj alternativ tid"
						placeholder="Tillgängliga tider"
						id={`week-${week.week}-time`}
						options={week.suggestedTimes.map((t) => ({ label: t, value: t }))}
						bind:selectedValue={week.selectedTime}
					/>
				{:else}
					<p class="mt-2 text-xs text-red-600">
						Ingen tillgänglig tid denna dag. Konflikten kan inte lösas.
					</p>
				{/if}

				<div class="mt-2 flex gap-2">
					<Button
						text="Lös"
						variant="primary"
						small
						disabled={!week.suggestedTimes || week.suggestedTimes.length === 0}
						on:click={() => resolveConflict(week.week)}
					/>
					<Button
						text="Avboka vecka"
						variant="secondary"
						small
						on:click={() => ignoreConflict(week.week)}
					/>
				</div>
			</div>
		</div>

		<div slot="ready" let:week class="border-green bg-green-bright/10 mb-1 rounded-sm border p-2">
			{week.date}, kl {week.selectedTime}
		</div>
	</RepeatBookingSection>
</div>
