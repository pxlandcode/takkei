<script lang="ts">
        import { onMount, onDestroy, tick } from 'svelte';
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
        import { formatTime } from '$lib/helpers/calendarHelpers/calendar-utils';
        import { locations as locationsStore, fetchLocations } from '$lib/stores/locationsStore';
        import type { Location } from '$lib/stores/locationsStore';

	export let startHour = 4;
	export let totalHours = 19;
	export let singleDayView = false;
	export let isMobile = false;
	export let mobileWeekMode = false;

	const dispatch = createEventDispatcher();

        type AvailabilityMap = Record<string, { from: string; to: string }[] | null>;
        type LayoutInfo = {
                booking: FullBooking;
                columnIndex: number;
                columnCount: number;
        };

        type SlotActionState = {
                dayIndex: number;
                slotStart: Date;
                slotStartMs: number;
                booking: FullBooking;
                triggerRect: DOMRect | null;
        };

        type BookingSelectionState = {
                dayIndex: number;
                slotStart: Date;
                slotStartMs: number;
                bookings: FullBooking[];
                triggerRect: DOMRect | null;
        };

	let calendarContainer: HTMLDivElement | null = null;

        let bookings: FullBooking[] = [];
        let filters: CalendarFilters | undefined;
        let availability: AvailabilityMap = {};
        let calendarIsLoading = false;

        let availableLocations: Location[] = [];
        let activeSlotAction: SlotActionState | null = null;
        let bookingSelection: BookingSelectionState | null = null;
        let selectionDialog: HTMLDialogElement | null = null;

        const unsubscribe = calendarStore.subscribe((store) => {
                bookings = store.bookings;
                filters = store.filters;
                availability = store.availability;
                calendarIsLoading = store.isLoading;
                if (activeSlotAction || bookingSelection) {
                        closeActivePanel();
                        resetSelectionDialog();
                }
        });

        const unsubscribeLocations = locationsStore.subscribe((value) => {
                availableLocations = Array.isArray(value) ? value : [];
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

	let weekDays: {
		dayLabel: string;
		dayShortLabel: string;
		dateLabel: string;
		fullDate: Date;
	}[] = [];

	let isCompactWeek = false;
	let timeColumnWidth = 'minmax(60px, 8%)';
	let dayColumnWidth = 'minmax(100px, 1fr)';
	let gridTemplateColumns = `${timeColumnWidth} repeat(${weekDays.length}, ${dayColumnWidth})`;

	$: isCompactWeek = isMobile && mobileWeekMode && !singleDayView;
	$: timeColumnWidth = isMobile ? 'minmax(48px, 12vw)' : 'minmax(60px, 8%)';
	$: dayColumnWidth = isCompactWeek ? 'minmax(0, 1fr)' : 'minmax(100px, 1fr)';
	$: gridTemplateColumns = `${timeColumnWidth} repeat(${weekDays.length}, ${dayColumnWidth})`;

	// Compute displayed days dynamically
	$: {
		if (singleDayView) {
			const selected = parseLocalDateStr(filters?.date);
			weekDays = [
				{
					dayLabel: selected.toLocaleDateString('sv-SE', { weekday: 'long' }),
					dayShortLabel: selected.toLocaleDateString('sv-SE', { weekday: 'short' }),
					dateLabel: selected.getDate().toString(),
					fullDate: selected
				}
			];
		} else {
			const startOfWeek = filters?.from
				? getMondayOfWeek(parseLocalDateStr(filters.from))
				: getMondayOfWeek(new Date());

			weekDays = Array.from({ length: 7 }, (_, i) => {
				const d = new Date(startOfWeek);
				d.setDate(d.getDate() + i);
				return {
					dayLabel: d.toLocaleDateString('sv-SE', { weekday: 'long' }),
					dayShortLabel: d.toLocaleDateString('sv-SE', { weekday: 'short' }),
					dateLabel: d.getDate().toString(),
					fullDate: d
				};
			});
		}
	}

        const hourHeight = 50;
        const SLOT_DURATION_MINUTES = 60;

	let dayDateStrings: string[] = [];
	let bookingsByDay: FullBooking[][] = [];
	let layoutByDay: LayoutInfo[][] = [];
	let emptySlotBlocksByDay: { top: number; start: Date }[][] = [];
	let unavailableBlocksByDay: { top: number; height: number }[][] = [];

	$: dayDateStrings = weekDays.map(({ fullDate }) => ymdLocal(fullDate));
	$: bookingsByDay = partitionBookingsByDay(bookings, dayDateStrings, filters, singleDayView);
	$: layoutByDay = bookingsByDay.map((dayBookings) => layoutDayBookings(dayBookings));
	$: emptySlotBlocksByDay = weekDays.map(({ fullDate }, idx) =>
		computeEmptySlotBlocks(fullDate, bookingsByDay[idx] ?? [], filters, availability)
	);
	$: unavailableBlocksByDay = weekDays.map(({ fullDate }) =>
		computeUnavailableBlocks(fullDate, filters, availability)
	);

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

        function getSlotEnd(start: Date): Date {
                const end = new Date(start);
                end.setMinutes(end.getMinutes() + SLOT_DURATION_MINUTES);
                return end;
        }

        function findBookingsForSlot(
                slotStart: Date,
                dayIndex: number,
                locationId: number | null = null
        ): FullBooking[] {
                const slotEnd = getSlotEnd(slotStart);
                const dayBookings = bookingsByDay[dayIndex] ?? [];

                return dayBookings.filter((booking) => {
                        if (locationId && booking.location?.id !== locationId) {
                                return false;
                        }

                        const bookingStart = new Date(booking.booking.startTime);
                        const bookingEnd = booking.booking.endTime
                                ? new Date(booking.booking.endTime)
                                : new Date(bookingStart.getTime() + SLOT_DURATION_MINUTES * 60 * 1000);

                        return bookingStart < slotEnd && bookingEnd > slotStart;
                });
        }

        function getSingleFilteredLocation(): Location | null {
                const locationIds = filters?.locationIds ?? [];
                if (!locationIds || locationIds.length !== 1) {
                        return null;
                }
                if (filters?.roomId != null) {
                        return null;
                }

                return availableLocations.find((location) => location.id === locationIds[0]) ?? null;
        }

        function countActiveRooms(location: Location | null): number {
                if (!location || !Array.isArray(location.rooms)) {
                        return 0;
                }
                return location.rooms.filter((room) => room?.active !== false).length;
        }

        function formatBookingTimeRange(booking: FullBooking): string {
                const start = booking.booking.startTime;
                const end =
                        booking.booking.endTime ??
                        new Date(new Date(start).getTime() + SLOT_DURATION_MINUTES * 60 * 1000).toISOString();
                return `${formatTime(start)} – ${formatTime(end)}`;
        }

        function formatSlotStartLabel(slotStart: Date): string {
                return formatTime(slotStart.toISOString());
        }

        function getOverlayPosition(rect: DOMRect | null) {
                if (typeof window === 'undefined') {
                        return { left: 0, top: 0 };
                }
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const fallbackLeft = viewportWidth / 2;
                const fallbackTop = viewportHeight / 2;

                if (!rect) {
                        return { left: fallbackLeft, top: fallbackTop };
                }

                const horizontalPadding = 24;
                const verticalOffset = 16;
                const left = Math.min(
                        Math.max(rect.left + rect.width / 2, horizontalPadding),
                        viewportWidth - horizontalPadding
                );
                const top = Math.max(rect.top - verticalOffset, verticalOffset);
                return { left, top };
        }

        function closeActivePanel() {
                activeSlotAction = null;
        }

        function resetSelectionDialog() {
                if (selectionDialog?.open) {
                        selectionDialog.close();
                }
                bookingSelection = null;
        }

        function clearSlotInteractions() {
                closeActivePanel();
                resetSelectionDialog();
        }

        function handleEmptySlotClick(event: Event, slotStart: Date) {
                event.stopPropagation();
                if (event instanceof KeyboardEvent) {
                        event.preventDefault();
                }
                clearSlotInteractions();
                openBookingPopup(new Date(slotStart));
        }

        function handleSlotKeydown(event: KeyboardEvent, slotStart: Date) {
                if (event.key === 'Enter' || event.key === ' ') {
                        handleEmptySlotClick(event, slotStart);
                }
        }

        async function handleBookingSlotClick(
                event: MouseEvent,
                booking: FullBooking,
                dayIndex: number
        ) {
                event.stopPropagation();

                const singleLocation = getSingleFilteredLocation();
                const hasSpecificRoomSelected = filters?.roomId != null;
                const hasMultipleRooms = countActiveRooms(singleLocation) > 1;

                if (!singleLocation || !hasMultipleRooms || hasSpecificRoomSelected) {
                        clearSlotInteractions();
                        onOpenBooking(booking);
                        return;
                }

                const slotStart = new Date(booking.booking.startTime);
                const overlappingBookings = findBookingsForSlot(slotStart, dayIndex, singleLocation.id);
                const rect = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect() ?? null;

                if (overlappingBookings.length <= 1) {
                        resetSelectionDialog();
                        activeSlotAction = {
                                dayIndex,
                                slotStart,
                                slotStartMs: slotStart.getTime(),
                                booking,
                                triggerRect: rect
                        };
                        return;
                }

                closeActivePanel();
                await showBookingSelectionDialog({
                        dayIndex,
                        slotStart,
                        slotStartMs: slotStart.getTime(),
                        bookings: overlappingBookings,
                        triggerRect: rect
                });
        }

        async function showBookingSelectionDialog(state: BookingSelectionState) {
                bookingSelection = state;
                await tick();
                if (!selectionDialog) return;
                if (!selectionDialog.open) {
                        selectionDialog.showModal();
                }
                positionSelectionDialog(state);
        }

        function positionSelectionDialog(state: BookingSelectionState) {
                if (!selectionDialog) return;
                const position = getOverlayPosition(state.triggerRect);
                selectionDialog.style.left = `${position.left}px`;
                selectionDialog.style.top = `${position.top}px`;
        }

        function handleDialogBackdropClick(event: MouseEvent) {
                if (!selectionDialog) return;
                if (event.target === selectionDialog) {
                        selectionDialog.close();
                }
        }

        function handleSelectionDialogClose() {
                bookingSelection = null;
        }

        function openBookingFromPanel() {
                if (!activeSlotAction) return;
                const { booking } = activeSlotAction;
                clearSlotInteractions();
                onOpenBooking(booking);
        }

        function createBookingFromPanel() {
                if (!activeSlotAction) return;
                const { slotStart } = activeSlotAction;
                clearSlotInteractions();
                openBookingPopup(new Date(slotStart));
        }

        function openBookingFromDialog(booking: FullBooking) {
                clearSlotInteractions();
                onOpenBooking(booking);
        }

        function openBookingPopup(startTime: Date) {
                dispatch('onTimeSlotClick', { startTime });
        }

	function handleCompactDaySelection(fullDate: Date) {
		if (!isCompactWeek) return;
		dispatch('daySelected', { date: ymdLocal(fullDate) });
	}

        onMount(() => {
                if (!availableLocations.length) {
                        fetchLocations().catch(() => {
                                // handled in store
                        });
                }

                const handleKeydown = (event: KeyboardEvent) => {
                        if (event.key === 'Escape') {
                                clearSlotInteractions();
                        }
                };

                const handleResize = () => {
                        if (bookingSelection) {
                                positionSelectionDialog(bookingSelection);
                        }
                };

                window.addEventListener('keydown', handleKeydown);
                window.addEventListener('resize', handleResize);

                return () => {
                        window.removeEventListener('keydown', handleKeydown);
                        window.removeEventListener('resize', handleResize);
                };
        });

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
                dispatch('onBookingClick', { booking });
        }

        onDestroy(() => {
                unsubscribe();
                unsubscribeLocations();
                resetSelectionDialog();
        });
</script>

<div
        class="flex h-full flex-col overflow-x-auto rounded-tl-md rounded-tr-md md:gap-10"
        on:click={clearSlotInteractions}
>
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
                                        {@const slotEnd = new Date(slot.start.getTime() + SLOT_DURATION_MINUTES * 60 * 1000)}
                                        {@const slotLabel = `${slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${slotEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                        <button
                                                type="button"
                                                class="hover:bg-orange/20 absolute right-0 left-0 cursor-pointer"
                                                style="top: {slot.top}px; height: {hourHeight}px; z-index: 0;"
                                                aria-label={slotLabel}
                                                on:click={(event) => handleEmptySlotClick(event, slot.start)}
                                                on:keydown={(event) => handleSlotKeydown(event, slot.start)}
                                                use:tooltip={{ content: slotLabel }}
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
                                                onbookingselected={(event) =>
                                                        handleBookingSlotClick(event, layoutItem.booking, dayIndex)
                                                }
                                        />
                                {/each}
			</div>
                {/each}
        </div>

        {#if activeSlotAction}
                {@const panelPosition = getOverlayPosition(activeSlotAction.triggerRect)}
                <div
                        class="slot-action-panel pointer-events-auto"
                        style={`top: ${panelPosition.top}px; left: ${panelPosition.left}px;`}
                        role="dialog"
                        aria-label="Alternativ för bokningsslot"
                        on:click|stopPropagation
                >
                        <p class="text-[11px] uppercase tracking-[0.3em] text-gray-500">
                                {formatBookingTimeRange(activeSlotAction.booking)}
                        </p>
                        {#if activeSlotAction.booking.room?.name}
                                <p class="mt-1 text-sm font-medium text-gray-700">
                                        {activeSlotAction.booking.room.name}
                                </p>
                        {/if}
                        <div class="mt-3 flex gap-2">
                                <button
                                        type="button"
                                        class="slot-action-button slot-action-button--secondary"
                                        on:click={openBookingFromPanel}
                                >
                                        Öppna bokning
                                </button>
                                <button
                                        type="button"
                                        class="slot-action-button slot-action-button--primary"
                                        on:click={createBookingFromPanel}
                                >
                                        Skapa bokning
                                </button>
                        </div>
                </div>
        {/if}

        <dialog
                class="booking-selection-dialog"
                bind:this={selectionDialog}
                on:click|stopPropagation={handleDialogBackdropClick}
                on:close={handleSelectionDialogClose}
        >
                {#if bookingSelection}
                        <div class="flex flex-col gap-3">
                                <div>
                                        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
                                                {formatSlotStartLabel(bookingSelection.slotStart)}
                                        </p>
                                        <h2 class="mt-1 text-sm font-semibold text-gray-800">
                                                Välj bokning att öppna
                                        </h2>
                                </div>
                                <div class="space-y-2">
                                        {#each bookingSelection.bookings as booking (booking.booking.id)}
                                                <button
                                                        type="button"
                                                        class="booking-selection-option"
                                                        on:click={() => openBookingFromDialog(booking)}
                                                >
                                                        <div class="flex items-center justify-between gap-2">
                                                                <span class="text-sm font-semibold text-gray-800">
                                                                        {booking.room?.name ?? 'Okänt rum'}
                                                                </span>
                                                                <span class="text-xs text-gray-500">
                                                                        {formatBookingTimeRange(booking)}
                                                                </span>
                                                        </div>
                                                        <div class="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                                                                {#if booking.trainer}
                                                                        <span
                                                                                >Tränare:
                                                                                {`${booking.trainer.firstname} ${booking.trainer.lastname}`}
                                                                        </span>
                                                                {/if}
                                                                {#if booking.client}
                                                                        <span
                                                                                >Kund:
                                                                                {`${booking.client.firstname ?? ''} ${booking.client.lastname ?? ''}`.trim() ||
                                                                                        'Ej angiven'}
                                                                        </span>
                                                                {/if}
                                                        </div>
                                                </button>
                                        {/each}
                                </div>
                        </div>
                {/if}
        </dialog>
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

        .slot-action-panel {
                position: fixed;
                z-index: 70;
                transform: translate(-50%, -100%) translateY(-8px);
                border-radius: 16px;
                background: #ffffff;
                padding: 16px;
                box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
                min-width: 220px;
                max-width: min(320px, calc(100vw - 48px));
                border: 1px solid rgba(148, 163, 184, 0.25);
        }

        .slot-action-button {
                flex: 1;
                border-radius: 9999px;
                font-weight: 600;
                font-size: 0.875rem;
                padding: 0.5rem 0.75rem;
                transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
        }

        .slot-action-button--secondary {
                background: #ffffff;
                color: #ea580c;
                border: 1px solid rgba(234, 88, 12, 0.4);
        }

        .slot-action-button--secondary:hover {
                background: rgba(234, 88, 12, 0.08);
        }

        .slot-action-button--primary {
                background: #ea580c;
                color: #ffffff;
        }

        .slot-action-button--primary:hover {
                background: #f97316;
        }

        .booking-selection-dialog {
                position: fixed;
                z-index: 80;
                margin: 0;
                padding: 20px;
                border: none;
                border-radius: 18px;
                background: #ffffff;
                transform: translate(-50%, -100%) translateY(-12px);
                box-shadow: 0 24px 50px rgba(15, 23, 42, 0.22);
                min-width: 280px;
                max-width: min(360px, calc(100vw - 48px));
        }

        .booking-selection-dialog::backdrop {
                background: rgba(15, 23, 42, 0.2);
        }

        .booking-selection-option {
                width: 100%;
                text-align: left;
                border-radius: 12px;
                border: 1px solid rgba(148, 163, 184, 0.25);
                padding: 12px 14px;
                background: rgba(255, 255, 255, 0.95);
                transition: border-color 120ms ease, box-shadow 120ms ease;
        }

        .booking-selection-option:hover,
        .booking-selection-option:focus-visible {
                border-color: rgba(234, 88, 12, 0.6);
                box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.15);
        }
</style>
