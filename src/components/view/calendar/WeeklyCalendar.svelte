<script lang="ts">
	import { onMount, tick } from 'svelte';
	import HourSlot from './hour-slot/HourSlot.svelte';
	import MeetingSlot from './meeting-slot/MeetingSlot.svelte';
	import CurrentTimeIndicator from './current-time-indicator/CurrentTimeIndicator.svelte';
	import { getCurrentTimeOffset } from '$lib/helpers/calendarHelpers/calendar-utils';
	import type { FullBooking } from '$lib/types/calendarTypes';

	export let bookings: FullBooking[] = [];
	export let startHour = 5;
	export let totalHours = 18;
	export let weekDays: string[] = [
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday',
		'Sunday'
	];

	const hourHeight = 60; // 1 hour = 60px
	let calendarContainer: HTMLDivElement | null = null;

	onMount(async () => {
		await tick();
		if (calendarContainer) {
			calendarContainer.scrollTop = getCurrentTimeOffset(startHour, hourHeight) - hourHeight;
		}
	});
</script>

<div class="w-full overflow-x-auto whitespace-nowrap">
	<!-- Calendar Header -->
	<div class="grid grid-cols-7 py-2 text-center font-bold">
		{#each weekDays as day}
			<div class="px-2 py-2 text-text">{day}</div>
		{/each}
	</div>

	<!-- Calendar Body -->
	<div
		bind:this={calendarContainer}
		class="relative grid h-[600px] grid-cols-7 overflow-y-auto border-t border-gray-300"
	>
		{#each weekDays as day, dayIndex}
			<div class="relative border-r border-gray-300">
				<!-- Hour Slots -->
				{#each Array.from({ length: totalHours }, (_, i) => (startHour + i) % 24) as hour, index}
					<HourSlot {hour} {index} {hourHeight} />
				{/each}
				<CurrentTimeIndicator {startHour} {hourHeight} />

				<!-- Meetings -->
				{#each bookings.filter((b) => new Date(b.booking.startTime).getDay() === dayIndex) as booking, i}
					<MeetingSlot {booking} {startHour} {hourHeight} {i} />
				{/each}
			</div>
		{/each}
	</div>
</div>
