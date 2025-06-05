<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { getCurrentTimeOffset, shiftUTCIndex } from '$lib/helpers/calendarHelpers/calendar-utils';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import HourSlot from './hour-slot/HourSlot.svelte';
	import CurrentTimePill from './current-time-pill/CurrentTimePill.svelte';
	import BookingSlot from './booking-slot/BookingSlot.svelte';
	import CurrentTimeIndicator from './current-time-indicator/current-time-indicator.svelte';
	import { calendarStore } from '$lib/stores/calendarStore';
	import ClockIcon from '../../bits/clock-icon/ClockIcon.svelte';
	import { createEventDispatcher } from 'svelte';
	import { tooltip } from '$lib/actions/tooltip';

	// Props
	export let startHour = 5;
	export let totalHours = 18;
	export let singleDayView = false; // ✅ Determines single-day or week mode

	let timePillRef: HTMLDivElement | null = null;

	const dispatch = createEventDispatcher();

	// Subscribe to calendar store
	let bookings: FullBooking[] = [];
	let filters;
	const unsubscribe = calendarStore.subscribe((store) => {
		bookings = store.bookings;
		filters = store.filters;
	});

	function isTimeSlotOccupied(start: Date, end: Date, bookingsForDay: FullBooking[]): boolean {
		const startMs = start.getTime();
		const endMs = end.getTime();

		return bookingsForDay.some((b) => {
			const bStart = getStart(b);
			const bEnd = getEnd(b);
			return !(bEnd <= startMs || bStart >= endMs); // overlaps
		});
	}

	// 🔥 Ensure week starts on Monday
	function getMondayOfWeek(date: Date): Date {
		const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
		const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days. Otherwise, adjust to Monday.
		const monday = new Date(date);
		monday.setDate(monday.getDate() + diff);
		return monday;
	}

	// ✅ Compute displayed days dynamically
	let weekDays: { day: string; date: string }[] = [];

	$: {
		if (singleDayView) {
			// If `singleDayView` is enabled, show only the selected date
			const selectedDate = new Date(filters.date);

			weekDays = [
				{
					day: selectedDate.toLocaleDateString('sv-SE', { weekday: 'long' }),
					date: selectedDate.getDate().toString()
				}
			];
		} else {
			// Otherwise, show a full week (Monday → Sunday)
			const startOfWeek = filters.from
				? getMondayOfWeek(new Date(filters.from))
				: getMondayOfWeek(new Date());

			weekDays = Array.from({ length: 7 }, (_, i) => {
				const date = new Date(startOfWeek);
				date.setDate(date.getDate() + i);
				return {
					day: date.toLocaleDateString('sv-SE', { weekday: 'long' }),
					date: date.getDate().toString()
				};
			});
		}
	}

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

	// Layout bookings within a day for proper display
	function layoutDayBookings(bookingsForDay: FullBooking[], selectedDate?: Date) {
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

		// Ensure bookings are correctly placed in the selected date column
		for (const booking of bookingsForDay) {
			const start = getStart(booking);
			const end = getEnd(booking);
			const bookingStartDate = new Date(start);

			// ✅ If single-day view, filter out bookings that are NOT for the selected date
			if (selectedDate) {
				const isSameDay =
					bookingStartDate.getFullYear() === selectedDate.getFullYear() &&
					bookingStartDate.getMonth() === selectedDate.getMonth() &&
					bookingStartDate.getDate() === selectedDate.getDate();

				if (!isSameDay) continue; // Skip bookings that are NOT for the selected day
			}

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

	function getEmptySlotBlocks(dayIndex: number): { top: number; start: Date }[] {
		const results: { top: number; start: Date }[] = [];

		const dayDate = singleDayView
			? new Date(filters.date)
			: getMondayOfWeek(filters.from ? new Date(filters.from) : new Date());

		dayDate.setDate(dayDate.getDate() + dayIndex);

		const dayBookings = bookings.filter((b) =>
			singleDayView
				? new Date(b.booking.startTime).toDateString() === dayDate.toDateString()
				: shiftUTCIndex(new Date(b.booking.startTime)) === dayIndex
		);

		for (let i = 0; i < totalHours * 2 - 1; i++) {
			// Only allow blocks starting at half past
			if (i % 2 === 0) continue;

			const hour = startHour + Math.floor(i / 2);
			const minute = 30;

			const slotStart = new Date(dayDate);
			slotStart.setHours(hour, minute, 0, 0);

			const slotEnd = new Date(slotStart);
			slotEnd.setMinutes(slotEnd.getMinutes() + 60);

			const isOccupied = isTimeSlotOccupied(slotStart, slotEnd, dayBookings);

			if (!isOccupied) {
				results.push({
					top: i * (hourHeight / 2),
					start: slotStart
				});
			}
		}

		return results;
	}

	function openBookingPopup(startTime: Date) {
		console.log('🟢 Open booking popup for:', startTime.toISOString());
		dispatch('onTimeSlotClick', { startTime });
	}

	// 📌 Scroll to current time on mount
	onMount(() => {
		const now = new Date();
		const currentHour = now.getHours();
		const offset = (currentHour - startHour) * hourHeight - hourHeight * 2;

		if (calendarContainer) {
			calendarContainer.scrollTo({
				top: Math.max(offset, 0),
				behavior: 'smooth'
			});
		}
	});

	function onOpenBooking(booking: FullBooking) {
		console.log('Booking clicked:', booking);
		dispatch('onBookingClick', { booking });
	}

	// Cleanup store subscription
	onDestroy(() => {
		unsubscribe();
	});
</script>

<div class="flex h-full flex-col gap-10 overflow-x-auto rounded-tl-md rounded-tr-md">
	<!-- WEEK HEADER -->
	<div
		class="relative grid h-16"
		style="grid-template-columns: minmax(60px, 8%) repeat({weekDays.length}, minmax(100px, 1fr));"
	>
		<div class="relative flex h-full flex-col items-center justify-center text-gray">
			<ClockIcon size="30px" />
		</div>
		{#each weekDays as { day, date }}
			<div
				class="mx-1 flex flex-col items-center rounded-lg bg-gray py-2 text-white {date ===
					new Date().getDate().toString() && 'bg-orange'}"
			>
				<p class="text-lg">{day}</p>
				<p class="text-4xl">{date}</p>
			</div>
		{/each}
	</div>

	<!-- CALENDAR GRID -->
	<div
		bind:this={calendarContainer}
		class="relative grid grid-cols-{weekDays.length + 1}  overflow-x-hidden bg-gray-bright/20"
		style="grid-template-columns: minmax(60px, 8%) repeat({weekDays.length}, minmax(100px, 1fr));"
	>
		<CurrentTimeIndicator {startHour} {hourHeight} />

		<div class="relative flex flex-col items-center">
			<CurrentTimePill {startHour} {hourHeight} />
			{#each Array.from({ length: totalHours }, (_, i) => (startHour + i) % 24) as hour, index}
				<HourSlot {hour} {index} {hourHeight} hideLabel={index === 0} />
			{/each}
		</div>

		<!-- DAYS & BOOKINGS -->
		{#each weekDays as { day, date }, dayIndex}
			<div class="border-gray-dark relative flex flex-col gap-1 border-l">
				{#each getEmptySlotBlocks(dayIndex) as slot}
					<button
						class="absolute left-0 right-0 cursor-pointer hover:bg-orange/20"
						style="top: {slot.top}px; height: {hourHeight}px; z-index: 0;"
						on:click={() => openBookingPopup(slot.start)}
						use:tooltip={{
							content: `${slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(slot.start.getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
						}}
					>
					</button>
				{/each}
				{#each layoutDayBookings( bookings.filter( (b) => (singleDayView ? new Date(b.booking.startTime).toDateString() === new Date(filters.date).toDateString() : shiftUTCIndex(new Date(b.booking.startTime)) === dayIndex) ), singleDayView ? new Date(filters.date) : undefined ) as layoutItem, i}
					<BookingSlot
						booking={layoutItem.booking}
						{startHour}
						{hourHeight}
						{i}
						columnIndex={layoutItem.columnIndex}
						columnCount={layoutItem.columnCount}
						toolTipText={layoutItem.booking.client?.firstname +
							' ' +
							layoutItem.booking.client?.lastname || ''}
						on:onClick={(e) => onOpenBooking(e.detail.booking)}
					/>
				{/each}
			</div>
		{/each}
	</div>
</div>
