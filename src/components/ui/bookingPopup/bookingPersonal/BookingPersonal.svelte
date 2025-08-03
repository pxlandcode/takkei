<script lang="ts">
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';

	import Input from '../../../bits/Input/Input.svelte';
	import TextArea from '../../../bits/textarea/TextArea.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import Button from '../../../bits/button/Button.svelte';

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
			<label class="text-sm font-medium text-gray" for="date">Datum</label>
			<input
				type="date"
				id="date"
				bind:value={bookingObject.date}
				class="text-gray0 w-full rounded-lg border p-2"
			/>
		</div>
		<div>
			<label class="text-sm font-medium text-gray" for="time">Starttid</label>
			<input
				type="time"
				id="time"
				bind:value={bookingObject.time}
				class="w-full rounded-lg border p-2 text-gray"
			/>
		</div>
		<div>
			<label class="text-sm font-medium text-gray" for="endTime">Sluttid</label>
			<input
				type="time"
				id="endTime"
				bind:value={bookingObject.endTime}
				class="w-full rounded-lg border p-2 text-gray"
			/>
		</div>
	</div>

	<!-- Repeat -->
	<label class="flex items-center gap-2 text-sm font-medium text-gray-700">
		<input type="checkbox" bind:checked={bookingObject.repeat} class="h-4 w-4" />
		Upprepa denna bokning
	</label>

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

				{#each repeatedBookings.filter((b) => b.conflict) as week}
					<div class="mb-2 rounded border border-red bg-red/10 p-3">
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
							{/if}

							<div class="mt-2 flex gap-2">
								<Button
									text="Lös"
									variant="primary"
									small
									on:click={() => resolveConflict(week.week)}
								/>
								<Button
									text="Ta bort vecka"
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
