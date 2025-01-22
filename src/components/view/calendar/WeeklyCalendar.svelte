<script lang="ts">
	import { onMount, tick } from 'svelte';
	import HourSlot from './hour-slot/HourSlot.svelte';

	import {
		getCurrentTimeOffset,
		getStartOfWeek,
		shiftUTCIndex
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

	const hourHeight = 80; // 1 hour = 80px
	let calendarContainer: HTMLDivElement | null = null;

	function getStart(booking: FullBooking): number {
		return new Date(booking.booking.startTime).getTime();
	}

	function getEnd(booking: FullBooking): number {
		// Fallback if booking.booking.endTime is missing
		if (booking.booking.endTime) {
			return new Date(booking.booking.endTime).getTime();
		}
		// Default to +1 hour
		return getStart(booking) + 60 * 60 * 1000;
	}

	function layoutDayBookings(bookingsForDay: FullBooking[]) {
		// Sort by start time
		bookingsForDay.sort((a, b) => getStart(a) - getStart(b));

		type LayoutInfo = {
			booking: FullBooking;
			columnIndex: number;
			columnCount: number; // how many are currently overlapping
		};

		const results: LayoutInfo[] = [];

		// `active` will track currently overlapping bookings,
		// each with { booking, endTime, columnIndex }.
		let active: { booking: FullBooking; endTime: number; columnIndex: number }[] = [];

		// Helper to find the first free column index (lowest integer not used in active).
		function getFreeColumnIndex(): number {
			const used = active.map((a) => a.columnIndex);
			let index = 0;
			while (used.includes(index)) index++;
			return index;
		}

		for (const booking of bookingsForDay) {
			const start = getStart(booking);
			const end = getEnd(booking);

			// 1) Remove from `active` all bookings that have ended BEFORE this one starts
			active = active.filter((a) => a.endTime > start);

			// 2) Current concurrency is `active.length + 1`
			const concurrency = active.length + 1;

			// 3) The new booking gets the first free column index
			const colIndex = getFreeColumnIndex();

			// 4) Insert it into `active`
			active.push({ booking, endTime: end, columnIndex: colIndex });

			// 5) Update columnCount for all active bookings (because they overlap each other now)
			//    and ensure the results[] object is either created or updated for each.
			//    We'll reassign `columnCount` so they all get the same concurrency.
			for (const a of active) {
				let existing = results.find((r) => r.booking === a.booking);
				if (!existing) {
					existing = {
						booking: a.booking,
						columnIndex: a.columnIndex,
						columnCount: concurrency
					};
					results.push(existing);
				}
				// Update the concurrency (and columnIndex in case it changed)
				existing.columnIndex = a.columnIndex;
				existing.columnCount = concurrency;
			}
		}

		return results;
	}

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
			<div class="relative flex flex-col gap-1 border-l border-gray" style="position: relative;">
				<!-- dashed lines for hours, etc. -->
				{#each Array.from({ length: totalHours }, (_, i) => i) as _, index}
					<div
						class="absolute left-0 w-full border-dashed border-gray {index === 0 ? '' : 'border-b'}"
						style="top: {index * hourHeight}px;"
					></div>
				{/each}

				<!-- Layout the bookings for this day -->
				{#if bookings}
					{#each layoutDayBookings(bookings.filter((b) => shiftUTCIndex(new Date(b.booking.startTime)) === dayIndex)) as layoutItem, i}
						<!-- layoutItem has { booking, columnIndex, columnCount } -->
						<BookingSlot
							booking={layoutItem.booking}
							{startHour}
							{hourHeight}
							{i}
							columnIndex={layoutItem.columnIndex}
							columnCount={layoutItem.columnCount}
							toolTipText={new Date(layoutItem.booking.booking.startTime).getUTCDay().toString() +
								' ' +
								new Date(layoutItem.booking.booking.startTime).toString()}
						/>
					{/each}
				{/if}
			</div>
		{/each}
	</div>
</div>
