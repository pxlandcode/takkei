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

	function overlaps(a: FullBooking, b: FullBooking) {
		// Convert your ISO strings to Date objects if needed:
		const aStart = new Date(a.booking.startTime).getTime();
		const aEnd = a.booking.endTime
			? new Date(a.booking.endTime).getTime()
			: aStart + 60 * 60 * 1000; // fallback 1h
		const bStart = new Date(b.booking.startTime).getTime();
		const bEnd = b.booking.endTime
			? new Date(b.booking.endTime).getTime()
			: bStart + 60 * 60 * 1000;

		// They overlap if one's start is before the other's end AND
		// the other's start is before the first one's end.
		return aStart < bEnd && bStart < aEnd;
	}

	function layoutDayBookings(bookingsForDay: FullBooking[]) {
		// Sort by start time (and maybe end time to break ties).
		bookingsForDay.sort((a, b) => {
			const aStart = new Date(a.booking.startTime).getTime();
			const bStart = new Date(b.booking.startTime).getTime();
			return aStart - bStart;
		});

		/**
		 * columns: an array of arrays,
		 *   where columns[i] is an array of bookings already placed in column i.
		 *
		 * result: an array of layout data { booking, columnIndex, columnCount }.
		 */
		const columns: FullBooking[][] = [];
		const result: { booking: FullBooking; columnIndex: number; columnCount: number }[] = [];

		for (const booking of bookingsForDay) {
			let placed = false;
			// Try to place in an existing column:
			for (let colIndex = 0; colIndex < columns.length; colIndex++) {
				const lastInColumn = columns[colIndex][columns[colIndex].length - 1];
				// If this booking does NOT overlap with the last booking in col, we can place it here
				if (!overlaps(booking, lastInColumn)) {
					columns[colIndex].push(booking);
					result.push({
						booking,
						columnIndex: colIndex,
						columnCount: 0 // placeholder for now
					});
					placed = true;
					break;
				}
			}
			// If we couldn't place in any existing column, create a new one:
			if (!placed) {
				columns.push([booking]);
				result.push({
					booking,
					columnIndex: columns.length - 1,
					columnCount: 0 // placeholder for now
				});
			}
		}

		// The total number of columns is columns.length.
		// We'll update each record's columnCount to that maximum:
		const totalCols = columns.length;
		for (const item of result) {
			item.columnCount = totalCols;
		}
		return result;
	}

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
		class="grid-cols-8overflow-y-auto relative grid h-16 border-b border-gray bg-white"
		style="grid-template-columns: minmax(60px, 8%) repeat(7, minmax(100px, 1fr));"
	>
		<!-- Empty space for time labels -->
		<div class="relative flex h-full flex-col border-gray"></div>
		{#each weekDays as day}
			<div class="h-full content-center border-l py-2 text-center text-sm text-text">{day}</div>
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
			<div class="relative border-l border-gray" style="position: relative;">
				<!-- dashed lines for hours, etc. -->
				{#each Array.from({ length: totalHours }, (_, i) => i) as _, index}
					<div
						class="absolute left-0 w-full border-dashed border-gray {index === 0 ? '' : 'border-b'}"
						style="top: {index * hourHeight}px;"
					></div>
				{/each}

				<!-- Layout the bookings for this day -->
				{#if bookings}
					{#each layoutDayBookings(bookings.filter((b) => new Date(b.booking.startTime).getDay() === dayIndex)) as layoutItem, i}
						<BookingSlot
							booking={layoutItem.booking}
							{startHour}
							{hourHeight}
							{i}
							columnIndex={layoutItem.columnIndex}
							columnCount={layoutItem.columnCount}
						/>
					{/each}
				{/if}
			</div>
		{/each}
	</div>
</div>
