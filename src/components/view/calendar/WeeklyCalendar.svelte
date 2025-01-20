<script lang="ts">
	import { onMount, tick } from 'svelte';
	import HourSlot from './hour-slot/HourSlot.svelte';

	import {
		getCurrentTimeOffset,
		getStartOfWeek
	} from '$lib/helpers/calendarHelpers/calendar-utils';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import CurrentTimePill from './current-time-pill/CurrentTimePill.svelte';
	import CurrentTimeIndicator from './current-time-indicator/current-time-indicator.svelte';
	import BookingSlot from './booking-slot/BookingSlot.svelte';

	export let bookings: FullBooking[] = [];
	export let startHour = 5;
	export let totalHours = 18;

	// Compute the week's days with dates

	const startOfWeek = getStartOfWeek(new Date(bookings[0].booking.startTime));
	const weekDays = Array.from({ length: 7 }, (_, i) => {
		const date = new Date(startOfWeek);
		date.setDate(date.getDate() + i);
		const dayName = date.toLocaleDateString('sv-SE', { weekday: 'long' }); // Swedish day name
		const dayNumber = date.getDate();
		return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dayNumber}`;
	});

	const hourHeight = 80; // 1 hour = 80px
	let calendarContainer: HTMLDivElement | null = null;

	onMount(async () => {
		await tick();
		if (calendarContainer) {
			calendarContainer.scrollTop = getCurrentTimeOffset(startHour, hourHeight) - hourHeight;
		}
	});
</script>

<div class="overflow-x-auto rounded-tl-md rounded-tr-md border border-gray bg-gray-bright">
	<!-- Calendar Header (Days of the Week) -->
	<div
		class="relative grid grid-cols-8 overflow-y-auto border-b border-gray bg-white"
		style="grid-template-columns: minmax(60px, 8%) repeat(7, minmax(100px, 1fr));"
	>
		<!-- Empty space for time labels -->
		<div class="relative flex flex-col items-center border-gray"></div>
		{#each weekDays as day}
			<div class="border-l py-2 text-center text-text">{day}</div>
		{/each}
	</div>

	<!-- Calendar Body (Time Slots + Meetings) -->
	<div
		bind:this={calendarContainer}
		class="relative grid grid-cols-8 overflow-y-auto overflow-x-hidden border-gray"
		style="grid-template-columns: minmax(60px, 8%) repeat(7, minmax(100px, 1fr));"
	>
		<CurrentTimeIndicator {startHour} {hourHeight} />
		<!-- Time Column (First Column for Hour Slots) -->
		<div class="relative flex flex-col items-center border-gray bg-white">
			<CurrentTimePill {startHour} {hourHeight} />
			{#each Array.from({ length: totalHours }, (_, i) => (startHour + i) % 24) as hour, index}
				<HourSlot {hour} {index} {hourHeight} hideLabel={index === 0} />
			{/each}
		</div>

		<!-- Days Columns (Each Column is a Day) -->
		{#each weekDays as day, dayIndex}
			<div class="relative border-l border-gray">
				{#each Array.from({ length: totalHours }, (_, i) => i) as _, index}
					<div
						class="absolute left-0 w-full border-dashed border-gray {index === 0
							? ''
							: ' border-b'}"
						style="top: {index * hourHeight}px;"
					></div>
				{/each}

				{#each bookings.filter((b) => new Date(b.booking.startTime).getDay() === dayIndex) as booking, i}
					<BookingSlot {booking} {startHour} {hourHeight} {i} />
				{/each}
			</div>
		{/each}
	</div>
</div>
