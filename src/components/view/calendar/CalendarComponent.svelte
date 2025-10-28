<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import type { CalendarFilters } from '$lib/stores/calendarStore';
	import HourSlot from './hour-slot/HourSlot.svelte';
	import CurrentTimePill from './current-time-pill/CurrentTimePill.svelte';
	import BookingSlot from './booking-slot/BookingSlot.svelte';
	import CurrentTimeIndicator from './current-time-indicator/current-time-indicator.svelte';
	import { calendarStore } from '$lib/stores/calendarStore';
	import ClockIcon from '../../bits/clock-icon/ClockIcon.svelte';
	import { createEventDispatcher } from 'svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import SlotDialog from './slot-dialog/SlotDialog.svelte';

	let {
		startHour = 4,
		totalHours = 19,
		singleDayView = false,
		isMobile = false,
		mobileWeekMode = false
	}: {
		startHour?: number;
		totalHours?: number;
		singleDayView?: boolean;
		isMobile?: boolean;
		mobileWeekMode?: boolean;
	} = $props();

	const dispatch = createEventDispatcher();

	type AvailabilityMap = Record<string, { from: string; to: string }[] | null>;
	type LayoutInfo = {
		booking: FullBooking;
		columnIndex: number;
		columnCount: number;
	};


	let calendarContainer: HTMLDivElement | null = null;

	let bookings = $state<FullBooking[]>([]);
	let filters = $state<CalendarFilters | undefined>(undefined);
	let availability = $state<AvailabilityMap>({});
	let calendarIsLoading = $state(false);

	const unsubscribe = calendarStore.subscribe((store) => {
		bookings = store.bookings;
		filters = store.filters;
		availability = store.availability;
		calendarIsLoading = store.isLoading;
	});

	onMount(async () => {
		try {
			if (get(locations).length === 0) {
				await fetchLocations();
			}
		} catch (error) {
			console.error('Failed to load locations', error);
		}
	});

	function parseLocalDateStr(s?: string | null) {
		if (!s) return new Date();
		const [y, m, d] = s.split('-').map(Number);
		return new Date(y, m - 1, d, 12, 0, 0, 0);
	}

	function isSameLocalDay(a: Date, b: Date) {
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}

	function ymdLocal(d: Date) {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	function getMondayOfWeek(date: Date): Date {
		const day = date.getDay();
		const diff = day === 0 ? -6 : 1 - day;
		const monday = new Date(date);
		monday.setDate(monday.getDate() + diff);
		return monday;
	}

	type WeekDayInfo = {
		dayLabel: string;
		dayShortLabel: string;
		dateLabel: string;
		fullDate: Date;
	};

	const isCompactWeek = $derived(isMobile && mobileWeekMode && !singleDayView);
	const timeColumnWidth = $derived(isMobile ? 'minmax(48px, 12vw)' : 'minmax(60px, 8%)');
	const dayColumnWidth = $derived(isCompactWeek ? 'minmax(0, 1fr)' : 'minmax(100px, 1fr)');

	const weekDays = $derived.by<WeekDayInfo[]>(() => {
		if (singleDayView) {
			const selected = parseLocalDateStr(filters?.date);
			return [
				{
					dayLabel: selected.toLocaleDateString('sv-SE', { weekday: 'long' }),
					dayShortLabel: selected.toLocaleDateString('sv-SE', { weekday: 'short' }),
					dateLabel: selected.getDate().toString(),
					fullDate: selected
				}
			];
		}

		const startOfWeek = filters?.from
			? getMondayOfWeek(parseLocalDateStr(filters.from))
			: getMondayOfWeek(new Date());

		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(startOfWeek);
			d.setDate(d.getDate() + i);
			return {
				dayLabel: d.toLocaleDateString('sv-SE', { weekday: 'long' }),
				dayShortLabel: d.toLocaleDateString('sv-SE', { weekday: 'short' }),
				dateLabel: d.getDate().toString(),
				fullDate: d
			};
		});
	});

	const gridTemplateColumns = $derived(
		`${timeColumnWidth} repeat(${weekDays.length}, ${dayColumnWidth})`
	);

	const hourHeight = 50;

	const dayDateStrings = $derived(weekDays.map(({ fullDate }) => ymdLocal(fullDate)));

	const bookingsByDay = $derived.by(() =>
		partitionBookingsByDay(bookings, dayDateStrings, filters, singleDayView)
	);

	const layoutByDay = $derived(bookingsByDay.map((dayBookings) => layoutDayBookings(dayBookings)));

	const emptySlotBlocksByDay = $derived.by(() =>
		weekDays.map(({ fullDate }, idx) =>
			computeEmptySlotBlocks(fullDate, bookingsByDay[idx] ?? [], filters, availability)
		)
	);

	const unavailableBlocksByDay = $derived.by(() =>
		weekDays.map(({ fullDate }) => computeUnavailableBlocks(fullDate, filters, availability))
	);

	type SlotDialogActionsConfig = {
		mode: 'actions';
		booking: FullBooking;
		startTime: Date;
		locationId: number;
	};

	type SlotDialogSelectConfig = {
		mode: 'select';
		bookings: FullBooking[];
		startTime: Date;
		locationId: number;
	};

	type SlotDialogConfig = SlotDialogActionsConfig | SlotDialogSelectConfig;

	type SlotDialogView = {
		anchor: HTMLElement;
		config: SlotDialogConfig;
	};

	let slotDialogView = $state<SlotDialogView | null>(null);

	function openSlotDialog(anchor: HTMLElement, config: SlotDialogConfig): boolean {
		if (!anchor || !anchor.isConnected) return false;
		slotDialogView = { anchor, config };
		return true;
	}

	$effect(() => {
		const view = slotDialogView;
		if (!view) return;
		const locationIds = Array.isArray(filters?.locationIds) ? filters.locationIds : [];
		if (locationIds.length !== 1 || locationIds[0] !== view.config.locationId) {
			slotDialogView = null;
		}
	});

	$effect(() => {
		const view = slotDialogView;
		if (!view) return;
		if (!view.anchor.isConnected) {
			slotDialogView = null;
		}
	});

	$effect(() => {
		const view = slotDialogView;
		if (!view) return;
		if (!isMobile && view.config.mode === 'select') {
			slotDialogView = null;
			return;
		}
		if (view.config.mode === 'actions') {
			const bookingId = view.config.booking.booking.id;
			if (!bookings.some((current) => current.booking.id === bookingId)) {
				slotDialogView = null;
			}
		} else {
			const ids = new Set(view.config.bookings.map((option) => option.booking.id));
			const present = bookings.filter((b) => ids.has(b.booking.id)).length;
			if (present !== ids.size) {
				slotDialogView = null;
			}
		}
	});

	function getStart(booking: FullBooking): number {
		return new Date(booking.booking.startTime).getTime();
	}

	function getEnd(booking: FullBooking): number {
		if (booking.booking.endTime) {
			return new Date(booking.booking.endTime).getTime();
		}
		return getStart(booking) + 60 * 60 * 1000;
	}

	function isTimeSlotOccupied(start: Date, end: Date, bookingsForDay: FullBooking[]): boolean {
		const startMs = start.getTime();
		const endMs = end.getTime();

		return bookingsForDay.some((b) => {
			const bStart = getStart(b);
			const bEnd = getEnd(b);
			return !(bEnd <= startMs || bStart >= endMs);
		});
	}

	function layoutDayBookings(bookingsForDay: FullBooking[]): LayoutInfo[] {
		const sortedBookings = [...bookingsForDay].sort((a, b) => getStart(a) - getStart(b));

		const results: LayoutInfo[] = [];
		let active: { booking: FullBooking; endTime: number; columnIndex: number }[] = [];

		function getFreeColumnIndex(): number {
			const used = active.map((a) => a.columnIndex);
			let index = 0;
			while (used.includes(index)) index++;
			return index;
		}

		for (const booking of sortedBookings) {
			const start = getStart(booking);
			const end = getEnd(booking);

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

	function openBookingDetails(booking: FullBooking) {
		slotDialogView = null;
		dispatch('onBookingClick', { booking });
	}

	function openBookingCreation(startTime: Date) {
		slotDialogView = null;
		dispatch('onTimeSlotClick', { startTime });
	}

	function findBookingsInSameSlot(target: FullBooking, locationId: number): FullBooking[] {
		if (!target?.booking?.startTime) {
			return [target];
		}

		const dayKey = ymdLocal(new Date(target.booking.startTime));
		const targetStart = getStart(target);
		const targetEnd = getEnd(target);
		const matches: FullBooking[] = [];

		for (const booking of bookings) {
			if (!booking?.booking?.startTime) continue;
			if (booking.location?.id !== locationId) continue;

			const candidateDayKey = ymdLocal(new Date(booking.booking.startTime));
			if (candidateDayKey !== dayKey) continue;

			const bookingStart = getStart(booking);
			const bookingEnd = getEnd(booking);
			const overlaps = !(bookingEnd <= targetStart || bookingStart >= targetEnd);

			if (overlaps) {
				matches.push(booking);
			}
		}

		return matches
			.sort((a, b) => {
				const roomA = a.room?.name ?? '';
				const roomB = b.room?.name ?? '';

				if (roomA && roomB && roomA !== roomB) {
					return roomA.localeCompare(roomB, 'sv');
				}

				return getStart(a) - getStart(b);
			})
			.filter((booking, index, array) => {
				const firstIndex = array.findIndex((other) => other.booking.id === booking.booking.id);
				return firstIndex === index;
			});
	}

	function handleBookingSlotClick(event: MouseEvent, booking: FullBooking) {
		event.preventDefault();
		event.stopPropagation();

		const targetElement = event.currentTarget as HTMLElement | null;
		const bookingLocationId = booking.location?.id ?? null;

		if (!targetElement || !bookingLocationId) {
			openBookingDetails(booking);
			return;
		}

		const locationIds = Array.isArray(filters?.locationIds) ? filters.locationIds : [];
		if (locationIds.length !== 1 || locationIds[0] !== bookingLocationId) {
			openBookingDetails(booking);
			return;
		}

		const selectedLocation = get(locations).find((loc) => loc.id === bookingLocationId);
		const activeRooms = selectedLocation?.rooms?.filter((room) => room.active) ?? [];

		if (!selectedLocation || activeRooms.length <= 1) {
			openBookingDetails(booking);
			return;
		}

	const slotBookings = findBookingsInSameSlot(booking, bookingLocationId);

	if (slotBookings.length >= 2) {
		if (!isMobile) {
			openBookingDetails(booking);
			return;
		}

		const opened = openSlotDialog(targetElement, {
			mode: 'select',
			bookings: slotBookings,
			startTime: new Date(booking.booking.startTime),
			locationId: bookingLocationId
		});
		if (!opened) {
			openBookingDetails(booking);
		}
		return;
	}

	const opened = openSlotDialog(targetElement, {
		mode: 'actions',
		booking,
		startTime: new Date(booking.booking.startTime),
		locationId: bookingLocationId
	});

	if (!opened) {
		openBookingDetails(booking);
	}
}

	function partitionBookingsByDay(
		allBookings: FullBooking[],
		dayKeys: string[],
		currentFilters: CalendarFilters | undefined,
		isSingleDayView: boolean
	): FullBooking[][] {
		const buckets = Array.from({ length: dayKeys.length }, () => [] as FullBooking[]);

		if (!allBookings.length || !dayKeys.length) {
			return buckets;
		}

		if (isSingleDayView) {
			const targetKey = currentFilters?.date ?? dayKeys[0];
			if (!targetKey || !buckets.length) {
				return buckets;
			}
			for (const booking of allBookings) {
				const bookingKey = ymdLocal(new Date(booking.booking.startTime));
				if (bookingKey === targetKey) {
					buckets[0].push(booking);
				}
			}
			return buckets;
		}

		const indexByDate = new Map(dayKeys.map((key, index) => [key, index]));

		for (const booking of allBookings) {
			const bookingKey = ymdLocal(new Date(booking.booking.startTime));
			const index = indexByDate.get(bookingKey);
			if (index !== undefined) {
				buckets[index].push(booking);
			}
		}

		return buckets;
	}

	function computeEmptySlotBlocks(
		dayDateInput: Date,
		dayBookings: FullBooking[],
		currentFilters: CalendarFilters | undefined,
		availabilityMap: AvailabilityMap
	): { top: number; start: Date }[] {
		if (!dayDateInput) return [];
		const results: { top: number; start: Date }[] = [];

		const dayDate = new Date(dayDateInput);
		dayDate.setHours(0, 0, 0, 0);

		const onlyOneTrainer =
			Array.isArray(currentFilters?.trainerIds) && currentFilters.trainerIds.length === 1;
		const dateStr = ymdLocal(dayDate);
		const dayAvailability = onlyOneTrainer ? availabilityMap?.[dateStr] : undefined;

		for (let i = 1; i < totalHours * 2 - 1; i += 2) {
			const slotStart = new Date(dayDate);
			slotStart.setHours(startHour + Math.floor(i / 2), 30, 0, 0);

			const slotEnd = new Date(slotStart);
			slotEnd.setMinutes(slotEnd.getMinutes() + 60);

			const isOccupied = isTimeSlotOccupied(slotStart, slotEnd, dayBookings);

			let isAvailable = true;
			if (onlyOneTrainer) {
				if (dayAvailability == null) {
					isAvailable = true;
				} else if (Array.isArray(dayAvailability) && dayAvailability.length === 0) {
					isAvailable = false;
				} else if (Array.isArray(dayAvailability)) {
					isAvailable = dayAvailability.some((slot) => {
						const [fromHour, fromMin] = slot.from.split(':').map(Number);
						const [toHour, toMin] = slot.to.split(':').map(Number);

						const availableStart = new Date(dayDate);
						availableStart.setHours(fromHour, fromMin, 0, 0);
						const availableEnd = new Date(dayDate);
						availableEnd.setHours(toHour, toMin, 0, 0);

						return slotStart >= availableStart && slotEnd <= availableEnd;
					});
				}
			}

			if (!isOccupied && isAvailable) {
				results.push({ top: i * (hourHeight / 2), start: slotStart });
			}
		}

		return results;
	}

	function computeUnavailableBlocks(
		dayDateInput: Date,
		currentFilters: CalendarFilters | undefined,
		availabilityMap: AvailabilityMap
	): { top: number; height: number }[] {
		if (!currentFilters?.trainerIds || currentFilters.trainerIds.length !== 1) {
			return [];
		}

		const date = new Date(dayDateInput);
		date.setHours(0, 0, 0, 0);
		const dateStr = ymdLocal(date);

		const dayAvail = availabilityMap?.[dateStr];
		const blocks: { top: number; height: number }[] = [];

		if (dayAvail == null) {
			return blocks;
		}

		if (Array.isArray(dayAvail) && dayAvail.length === 0) {
			blocks.push({ top: 0, height: totalHours * hourHeight });
			return blocks;
		}

		if (!Array.isArray(dayAvail)) {
			return blocks;
		}

		const available = [...dayAvail].sort((a, b) =>
			a.from < b.from ? -1 : a.from > b.from ? 1 : 0
		);

		const dayStartMin = startHour * 60;
		const dayEndMin = (startHour + totalHours) * 60;

		let cursor = dayStartMin;

		for (const slot of available) {
			const [fh, fm] = slot.from.split(':').map(Number);
			const [th, tm] = slot.to.split(':').map(Number);
			const slotStartMin = fh * 60 + fm;
			const slotEndMin = th * 60 + tm;

			if (slotStartMin > cursor) {
				blocks.push({
					top: ((cursor - dayStartMin) / 60) * hourHeight,
					height: ((slotStartMin - cursor) / 60) * hourHeight
				});
			}
			cursor = Math.max(cursor, slotEndMin);
		}

		if (cursor < dayEndMin) {
			blocks.push({
				top: ((cursor - dayStartMin) / 60) * hourHeight,
				height: ((dayEndMin - cursor) / 60) * hourHeight
			});
		}

		return blocks;
	}

	function openBookingPopup(startTime: Date) {
		dispatch('onTimeSlotClick', { startTime });
	}

	function handleCompactDaySelection(fullDate: Date) {
		if (!isCompactWeek) return;
		dispatch('daySelected', { date: ymdLocal(fullDate) });
	}

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

onDestroy(() => {
	slotDialogView = null;
	unsubscribe();
});
</script>

<div class="flex h-full flex-col overflow-x-auto rounded-tl-md rounded-tr-md md:gap-10">
	<!-- WEEK HEADER -->
	<div
		class="relative grid"
		class:h-14={isMobile}
		class:h-16={!isMobile}
		style={`grid-template-columns: ${gridTemplateColumns};`}
	>
		<div class="text-gray relative flex h-full flex-col items-center justify-center">
			<ClockIcon size={isMobile ? '24px' : '30px'} />
		</div>
		{#if calendarIsLoading}
			<div
				class="text-gray-dark pointer-events-none absolute top-3 right-4 z-10 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium shadow-xs"
				aria-live="polite"
			>
				<svg
					class="text-orange h-4 w-4 animate-spin"
					viewBox="0 0 24 24"
					fill="none"
					aria-hidden="true"
				>
					<circle
						class="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					/>
					<path
						class="opacity-75"
						d="M4 12a8 8 0 018-8"
						stroke="currentColor"
						stroke-width="4"
						stroke-linecap="round"
					/>
				</svg>
				<span>Laddar kalender...</span>
			</div>
		{/if}
		{#each weekDays as { dayLabel, dayShortLabel, dateLabel, fullDate }, index (dateLabel)}
			<div
				class="bg-gray flex flex-col items-center text-white transition-colors focus:outline-none"
				class:mx-1={!isMobile}
				class:mx-0={isMobile}
				class:py-2={!isMobile}
				class:py-1={isMobile}
				class:rounded-lg={!isMobile}
				class:rounded-none={isMobile}
				class:border-r={isCompactWeek}
				class:border-white={isCompactWeek}
				class:border-opacity-40={isCompactWeek}
				class:border-r-0={isCompactWeek && index === weekDays.length - 1}
				class:cursor-pointer={isCompactWeek}
				class:bg-orange={isSameLocalDay(fullDate, new Date())}
				on:click={() => handleCompactDaySelection(fullDate)}
			>
				<p
					class="capitalize"
					class:text-lg={!isMobile}
					class:text-xs={isMobile}
					class:tracking-wide={isMobile}
				>
					{isCompactWeek ? dayShortLabel : dayLabel}
				</p>
				<p
					class="leading-tight font-semibold"
					class:text-4xl={!isMobile}
					class:text-base={isMobile}
				>
					{dateLabel}
				</p>
			</div>
		{/each}
	</div>

	<!-- CALENDAR GRID -->
	<div
		bind:this={calendarContainer}
		class="bg-gray-bright/20 relative grid"
		class:overflow-x-hidden={!isCompactWeek}
		class:overflow-x-auto={isCompactWeek}
		style={`grid-template-columns: ${gridTemplateColumns};`}
	>
		<CurrentTimeIndicator {startHour} {hourHeight} />

		<div class="relative flex flex-col items-center">
			<CurrentTimePill {startHour} {hourHeight} />
			{#each Array.from({ length: totalHours }, (_, i) => (startHour + i) % 24) as hour, index}
				<HourSlot {hour} {index} {hourHeight} hideLabel={index === 0} />
			{/each}
		</div>

		<!-- DAYS & BOOKINGS -->
		{#each weekDays as _, dayIndex}
			<div
				class="border-gray-bright relative flex flex-col gap-1 border-l"
				class:gap-0.5={isCompactWeek}
			>
				{#each unavailableBlocksByDay[dayIndex] ?? [] as block}
					<div
						class="unavailable-striped absolute right-0 left-0"
						style="top: {block.top}px; height: {block.height}px; z-index: 0;"
					/>
				{/each}

				{#each emptySlotBlocksByDay[dayIndex] ?? [] as slot}
					<button
						class="hover:bg-orange/20 absolute right-0 left-0 cursor-pointer"
						style="top: {slot.top}px; height: {hourHeight}px; z-index: 0;"
						on:click={() => openBookingPopup(slot.start)}
						use:tooltip={{
							content: `${slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(slot.start.getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
						}}
					>
					</button>
				{/each}
				{#each layoutByDay[dayIndex] ?? [] as layoutItem, i}
					<BookingSlot
						booking={layoutItem.booking}
						{startHour}
						{hourHeight}
						columnIndex={layoutItem.columnIndex}
						columnCount={layoutItem.columnCount}
						toolTipText={layoutItem.booking.booking.startTime
							? `${new Date(layoutItem.booking.booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ${layoutItem.booking.booking.endTime ? ` - ${new Date(layoutItem.booking.booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
							: ''}
						onbookingselected={(event) => handleBookingSlotClick(event, layoutItem.booking)}
					/>
				{/each}
			</div>
		{/each}
	</div>
	{#if slotDialogView}
		<SlotDialog
			anchor={slotDialogView.anchor}
			config={slotDialogView.config}
			on:close={() => (slotDialogView = null)}
			on:openBooking={(event) => {
				slotDialogView = null;
				openBookingDetails(event.detail.booking);
			}}
			on:createBooking={(event) => {
				slotDialogView = null;
				openBookingCreation(event.detail.startTime);
			}}
		/>
	{/if}
</div>

<style>
	.unavailable-striped {
		background-image: repeating-linear-gradient(
			45deg,
			rgba(255, 0, 0, 0.1) 0px,
			rgba(255, 0, 0, 0.1) 5px,
			transparent 5px,
			transparent 10px
		);
		pointer-events: none;
	}
</style>
