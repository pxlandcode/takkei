<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import {
		getStartOfWeek,
		getCurrentTimeOffset,
		shiftUTCIndex
	} from '$lib/helpers/calendarHelpers/calendar-utils';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import HourSlot from './hour-slot/HourSlot.svelte';
	import CurrentTimePill from './current-time-pill/CurrentTimePill.svelte';
	import BookingSlot from './booking-slot/BookingSlot.svelte';
	import CurrentTimeIndicator from './current-time-indicator/current-time-indicator.svelte';
	import { calendarStore } from '$lib/stores/calendarStore';

	// Props
	export let startHour = 5;
	export let totalHours = 18;

	// Subscribe to calendar store
	let bookings: FullBooking[] = [];
	let filters;
	const unsubscribe = calendarStore.subscribe((store) => {
		bookings = store.bookings;
		filters = store.filters;
	});

	// 🔥 Ensure week starts on Monday
	function getMondayOfWeek(date: Date): Date {
		const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
		const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days. Otherwise, adjust to Monday.
		const monday = new Date(date);
		monday.setDate(monday.getDate() + diff);
		return monday;
	}

	// Compute the week's days dynamically
	$: startOfWeek = filters.from
		? getMondayOfWeek(new Date(filters.from))
		: getMondayOfWeek(new Date());
	$: weekDays = Array.from({ length: 7 }, (_, i) => {
		const date = new Date(startOfWeek);
		date.setDate(date.getDate() + i);
		return date.toLocaleDateString('sv-SE', { weekday: 'long', day: '2-digit' });
	});

	const hourHeight = 80;
	let calendarContainer: HTMLDivElement | null = null;

	// 📍 Get booking start time
	function getStart(booking: FullBooking): number {
		return new Date(booking.booking.startTime).getTime();
	}

	// 📍 Get booking end time (or default to 1 hour)
	function getEnd(booking: FullBooking): number {
		if (booking.booking.endTime) {
			return new Date(booking.booking.endTime).getTime();
		}
		return getStart(booking) + 60 * 60 * 1000;
	}

	// 📌 Layout bookings within a day for proper display
	function layoutDayBookings(bookingsForDay: FullBooking[]) {
		bookingsForDay.sort((a, b) => getStart(a) - getStart(b));

		type LayoutInfo = {
			booking: FullBooking;
			columnIndex: number;
			columnCount: number;
		};

		const results: LayoutInfo[] = [];
		let active: { booking: FullBooking; endTime: number; columnIndex: number }[] = [];

		function getFreeColumnIndex(): number {
			const used = active.map((a) => a.columnIndex);
			let index = 0;
			while (used.includes(index)) index++;
			return index;
		}

		for (const booking of bookingsForDay) {
			const start = getStart(booking);
			const end = getEnd(booking);

			// Remove finished bookings
			active = active.filter((a) => a.endTime > start);

			const concurrency = active.length + 1;
			const colIndex = getFreeColumnIndex();
			active.push({ booking, endTime: end, columnIndex: colIndex });

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
				existing.columnIndex = a.columnIndex;
				existing.columnCount = concurrency;
			}
		}

		return results;
	}

	// 📌 Scroll to current time on mount
	onMount(async () => {
		await tick();
		if (calendarContainer) {
			calendarContainer.scrollTop = getCurrentTimeOffset(startHour, hourHeight) - hourHeight;
		}
	});

	// Cleanup store subscription
	onDestroy(() => {
		unsubscribe();
	});
</script>

<!-- WEEK HEADER -->
<div class="overflow-x-auto rounded-tl-md rounded-tr-md border border-gray bg-gray-bright">
	<div
		class="relative grid h-16 border-b border-gray bg-white"
		style="grid-template-columns: minmax(60px, 8%) repeat(7, minmax(100px, 1fr));"
	>
		<div class="relative flex h-full flex-col border-gray"></div>
		{#each weekDays as day}
			<div class="h-full content-center border-l py-2 text-center text-sm text-text">{day}</div>
		{/each}
	</div>

	<!-- CALENDAR GRID -->
	<div
		bind:this={calendarContainer}
		class="relative grid grid-cols-8 overflow-y-auto overflow-x-hidden border-gray"
		style="grid-template-columns: minmax(60px, 8%) repeat(7, minmax(100px, 1fr));"
	>
		<CurrentTimeIndicator {startHour} {hourHeight} />

		<div class="relative flex flex-col items-center border-gray bg-white">
			<CurrentTimePill {startHour} {hourHeight} />
			{#each Array.from({ length: totalHours }, (_, i) => (startHour + i) % 24) as hour, index}
				<HourSlot {hour} {index} {hourHeight} hideLabel={index === 0} />
			{/each}
		</div>

		<!-- DAYS & BOOKINGS -->
		{#each weekDays as day, dayIndex}
			<div class="relative flex flex-col gap-1 border-l border-gray">
				{#each layoutDayBookings(bookings.filter((b) => shiftUTCIndex(new Date(b.booking.startTime)) === dayIndex)) as layoutItem, i}
					<BookingSlot
						booking={layoutItem.booking}
						{startHour}
						{hourHeight}
						{i}
						columnIndex={layoutItem.columnIndex}
						columnCount={layoutItem.columnCount}
						toolTipText={new Date(layoutItem.booking.booking.startTime).toLocaleString('sv-SE')}
					/>
				{/each}
			</div>
		{/each}
	</div>
</div>
