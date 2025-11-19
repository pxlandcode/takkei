<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
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
	import { selectedSlot, clearSelectedSlot } from '$lib/stores/selectedSlotStore';
	import type { SelectedSlot } from '$lib/stores/selectedSlotStore';
	import { getMeetingHeight, getTopOffset } from '$lib/helpers/calendarHelpers/calendar-utils';

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

	// Access store data directly in derived values
	const storeValue = $derived($calendarStore);
	const pinnedSlot = $derived($selectedSlot);
	const bookings = $derived(storeValue.bookings);
	const filters = $derived(storeValue.filters);
	const availability = $derived(storeValue.availability);
	const calendarIsLoading = $derived(storeValue.isLoading);
	const holidays = $derived(storeValue.holidays ?? []);
	const holidayLookup = $derived.by(() => {
		const map = new Map<string, { name: string; description: string | null }>();
		for (const holiday of holidays) {
			if (!holiday?.date) continue;
			map.set(holiday.date, {
				name: holiday.name,
				description: holiday.description ?? null
			});
		}
		return map;
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
		dateKey: string;
		isWeekend: boolean;
		isHoliday: boolean;
		holidayName: string;
		holidayDescription: string | null;
	};

	const isCompactWeek = $derived(isMobile && mobileWeekMode && !singleDayView);
	const timeColumnWidth = $derived(isMobile ? 'minmax(48px, 12vw)' : 'minmax(60px, 8%)');
	const dayColumnWidth = $derived(isCompactWeek ? 'minmax(0, 1fr)' : 'minmax(100px, 1fr)');

	const weekDays = $derived.by<WeekDayInfo[]>(() => {
		const lookup = holidayLookup;
		if (singleDayView) {
			const selected = parseLocalDateStr(filters?.date);
			const key = ymdLocal(selected);
			const holiday = lookup.get(key);
			const isWeekend = [0, 6].includes(selected.getDay());
			return [
				{
					dayLabel: selected.toLocaleDateString('sv-SE', { weekday: 'long' }),
					dayShortLabel: selected.toLocaleDateString('sv-SE', { weekday: 'short' }),
					dateLabel: selected.getDate().toString(),
					fullDate: selected,
					dateKey: key,
					isWeekend,
					isHoliday: Boolean(holiday),
					holidayName: holiday?.name ?? '',
					holidayDescription: holiday?.description ?? null
				}
			];
		}

		// Use filters.from directly - it's already set to Monday by the store
		const startOfWeek = filters?.from
			? parseLocalDateStr(filters.from)
			: getMondayOfWeek(new Date());

		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(startOfWeek);
			d.setDate(d.getDate() + i);
			const dateKey = ymdLocal(d);
			const holiday = lookup.get(dateKey);
			const isWeekend = [0, 6].includes(d.getDay());
			return {
				dayLabel: d.toLocaleDateString('sv-SE', { weekday: 'long' }),
				dayShortLabel: d.toLocaleDateString('sv-SE', { weekday: 'short' }),
				dateLabel: d.getDate().toString(),
				fullDate: d,
				dateKey,
				isWeekend,
				isHoliday: Boolean(holiday),
				holidayName: holiday?.name ?? '',
				holidayDescription: holiday?.description ?? null
			};
		});
	});

	function splitName(full?: string | null) {
		if (!full) return { first: '', last: '' };
		const parts = full.trim().split(/\s+/).filter(Boolean);
		if (parts.length === 0) return { first: '', last: '' };
		if (parts.length === 1) return { first: parts[0], last: '' };
		return { first: parts[0], last: parts.slice(1).join(' ') };
	}

	function resolveNameParts(first?: string | null, last?: string | null, fallback?: string | null) {
		if (first || last) {
			return {
				first: first ?? '',
				last: last ?? ''
			};
		}
		return splitName(fallback);
	}

	function defaultKindFromSource(source: SelectedSlot['source']): string {
		switch (source) {
			case 'practice':
				return 'Praktiktimme';
			case 'education':
				return 'Utbildning';
			case 'trial':
				return 'Provträning';
			case 'flight':
				return 'Flygtimme';
			default:
				return 'Träning';
		}
	}

	function buildSelectedBooking(slot: SelectedSlot): FullBooking | null {
		if (!slot?.date || !slot?.time) return null;
		const start = new Date(`${slot.date}T${slot.time}`);
		if (Number.isNaN(start.getTime())) return null;
		const trainerId = slot.trainerId != null ? Number(slot.trainerId) : null;
		const locationId = slot.locationId != null ? Number(slot.locationId) : null;
		const clientId = slot.clientId != null ? Number(slot.clientId) : null;
		const traineeId = slot.traineeId != null ? Number(slot.traineeId) : null;
		const end = new Date(start.getTime() + 60 * 60 * 1000);
		const created = new Date(slot.createdAt ?? Date.now()).toISOString();
		const trainerParts = resolveNameParts(
			slot.trainerFirstName,
			slot.trainerLastName,
			slot.trainerName
		);
		const clientParts = resolveNameParts(
			slot.clientFirstName,
			slot.clientLastName,
			slot.clientName
		);
		const traineeParts = resolveNameParts(
			slot.traineeFirstName,
			slot.traineeLastName,
			slot.traineeName
		);
		const fallbackKind = defaultKindFromSource(slot.source);
		const bookingContentKind = slot.bookingType?.label ?? fallbackKind;
		const bookingContentId =
			typeof slot.bookingType?.value === 'number' ? slot.bookingType.value : 0;
		const syntheticId =
			typeof slot.createdAt === 'number' ? -Math.abs(slot.createdAt) : -Date.now();

		return {
			isPersonalBooking: false,
			booking: {
				id: syntheticId,
				status: 'selected',
				createdAt: created,
				updatedAt: created,
				startTime: start.toISOString(),
				endTime: end.toISOString(),
				cancelTime: null,
				actualCancelTime: null,
				repeatIndex: null,
				tryOut: slot.source === 'trial',
				refundComment: null,
				cancelReason: null,
				bookingWithoutRoom: true,
				internalEducation: slot.source === 'practice' || slot.source === 'education',
				userId: clientId ?? traineeId ?? null
			},
			trainer: trainerId
				? {
						id: trainerId,
						firstname: trainerParts.first,
						lastname: trainerParts.last
					}
				: undefined,
			client:
				slot.source === 'practice' || slot.source === 'education'
					? null
					: clientId
						? {
								id: clientId,
								firstname: clientParts.first,
								lastname: clientParts.last
							}
						: {
								id: -1,
								firstname: clientParts.first,
								lastname: clientParts.last
							},
			trainee:
				slot.source === 'practice' || slot.source === 'education'
					? {
							id: traineeId ?? -1,
							firstname: traineeParts.first,
							lastname: traineeParts.last
						}
					: null,
			room: null,
			location: locationId
				? {
						id: locationId,
						name: slot.locationName ?? 'Okänd plats',
						color: slot.locationColor ?? '#fb923c'
					}
				: null,
			additionalInfo: {
				education: slot.source === 'education',
				internal: slot.source === 'flight',
				bookingContent: {
					id: bookingContentId,
					kind: bookingContentKind
				}
			},
			personalBooking: null
		};
	}

	const gridTemplateColumns = $derived(
		`${timeColumnWidth} repeat(${weekDays.length}, ${dayColumnWidth})`
	);

	const hourHeight = 50;

	const dayDateStrings = $derived(weekDays.map(({ fullDate }) => ymdLocal(fullDate)));

	const bookingsByDay = $derived.by(() => {
		return partitionBookingsByDay(bookings, dayDateStrings, filters, singleDayView);
	});

	const pinnedSlotView = $derived.by(() => {
		const slot = pinnedSlot;
		if (!slot?.date || !slot?.time) return null;
		const dayIndex = weekDays.findIndex(({ fullDate }) => ymdLocal(fullDate) === slot.date);
		if (dayIndex === -1) return null;
		const booking = buildSelectedBooking(slot);
		if (!booking) return null;
		const startISO = booking.booking.startTime;
		const computedEnd =
			booking.booking.endTime ??
			new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString();
		const top = getTopOffset(startISO, startHour, hourHeight);
		const height = getMeetingHeight(startISO, computedEnd, hourHeight);
		const dayBookings = bookingsByDay[dayIndex] ?? [];
		const layoutWithPinned = layoutDayBookings([...dayBookings, booking]);
		const pinnedLayout = layoutWithPinned.find((info) => info.booking === booking);
		const columnIndex = pinnedLayout?.columnIndex ?? 0;
		const columnCount = pinnedLayout?.columnCount ?? 1;
		return { slot, dayIndex, booking, top, height, columnIndex, columnCount };
	});

	const layoutByDay = $derived(
		weekDays.map((_, dayIndex) => {
			const dayBookings = bookingsByDay[dayIndex] ?? [];
			if (pinnedSlotView && pinnedSlotView.dayIndex === dayIndex) {
				const combined = layoutDayBookings([...dayBookings, pinnedSlotView.booking]);
				return combined.filter((layout) => layout.booking !== pinnedSlotView.booking);
			}
			return layoutDayBookings(dayBookings);
		})
	);

	type LocationSummary = {
		id: number;
		name: string;
		color: string | null;
	};

	type TrainerSummary = {
		id: number;
		name: string;
		initials: string;
		color: string;
	};

	const trainerColorPalette = [
		'#fb7185',
		'#f87171',
		'#fbbf24',
		'#34d399',
		'#60a5fa',
		'#a78bfa',
		'#fb923c',
		'#38bdf8',
		'#f472b6',
		'#22d3ee'
	];

	function getTrainerColor(id: number): string {
		if (!Number.isFinite(id)) return '#94a3b8';
		const index = Math.abs(Math.trunc(id)) % trainerColorPalette.length;
		return trainerColorPalette[index] ?? '#94a3b8';
	}

	const selectedTrainerIds = $derived(
		Array.isArray(filters?.trainerIds)
			? filters.trainerIds.filter((id): id is number => typeof id === 'number')
			: []
	);

	function buildTrainerSummaryName(first?: string | null, last?: string | null, id?: number) {
		const firstName = first?.trim() ?? '';
		const lastName = last?.trim() ?? '';
		const combined = `${firstName} ${lastName}`.trim();
		if (combined) return combined;
		if (firstName || lastName) return firstName || lastName;
		return id != null ? `Tränare ${id}` : 'Tränare';
	}

	function buildTrainerInitials(first?: string | null, last?: string | null, id?: number) {
		const firstLetter = first?.trim()?.[0];
		const lastLetter = last?.trim()?.[0];
		if (firstLetter && lastLetter) return `${firstLetter}${lastLetter}`.toUpperCase();
		if (firstLetter) return firstLetter.toUpperCase();
		if (lastLetter) return lastLetter.toUpperCase();
		return id != null ? `T${id}` : 'TR';
	}

const selectedTrainerSummaries = $derived.by<TrainerSummary[]>(() => {
	const ids = selectedTrainerIds;
	if (!ids.length) return [];
	const infoLookup = new Map<number, { name: string; initials: string }>();
	for (const booking of bookings) {
		const trainer = booking.trainer;
		if (!trainer?.id || infoLookup.has(trainer.id)) continue;
		infoLookup.set(trainer.id, {
			name: buildTrainerSummaryName(trainer.firstname, trainer.lastname, trainer.id),
			initials: buildTrainerInitials(trainer.firstname, trainer.lastname, trainer.id)
		});
	}

	const summaries: TrainerSummary[] = [];
	const seen = new Set<number>();
	for (const id of ids) {
		if (seen.has(id)) continue;
		const info = infoLookup.get(id);
		summaries.push({
			id,
			name: info?.name ?? `Tränare ${id}`,
			initials: info?.initials ?? `T${id}`,
			color: getTrainerColor(id)
		});
		seen.add(id);
	}
	return summaries;
});

const trainerSummaryLookup = $derived.by(() => {
	const entries: [number, TrainerSummary][] = selectedTrainerSummaries.map((trainer) => [
		trainer.id,
		trainer
	]);
	return new Map(entries);
});

const selectedTrainerIdSet = $derived.by(() => new Set(selectedTrainerIds));
const trainerFilterCount = $derived.by(() => selectedTrainerIds.length);

	function getTrainerBucketId(
		booking: FullBooking,
		allowedTrainerIds: Set<number>
 ): number | null {
		const bookingTrainerId = booking.trainer?.id ?? null;
		if (bookingTrainerId != null && allowedTrainerIds.has(bookingTrainerId)) {
			return bookingTrainerId;
		}
	if (booking.isPersonalBooking) {
		const personalIds = booking.personalBooking?.userIds ?? [];
		if (Array.isArray(personalIds)) {
			for (const rawId of personalIds) {
				const numericId =
					typeof rawId === 'number'
						? rawId
						: typeof rawId === 'string' && rawId.trim() !== ''
							? Number(rawId)
							: null;
				if (numericId != null && Number.isFinite(numericId) && allowedTrainerIds.has(numericId)) {
					return numericId;
				}
			}
		}
	}
		return null;
	}

	const selectedLocationIds = $derived(
		Array.isArray(filters?.locationIds)
			? filters.locationIds.filter((id): id is number => typeof id === 'number')
			: []
	);

	function getLocationShortLabel(name?: string | null) {
		if (!name) return 'Plats';
		const trimmed = name.trim();
		if (!trimmed) return 'Plats';
		const letterMatch = trimmed.match(/[A-Za-zÅÄÖåäö]/);
		const firstLetter = (letterMatch ? letterMatch[0] : trimmed[0]).toUpperCase();
		const numberMatch = trimmed.match(/(\d+)/);
		const suffix = numberMatch ? numberMatch[1] : '';
		const label = `${firstLetter}${suffix}`;
		return label || firstLetter || 'Plats';
	}

	const selectedLocationSummaries = $derived.by<LocationSummary[]>(() => {
		const ids = selectedLocationIds;
		if (!ids.length) return [];
		const list = $locations ?? [];
		const lookup = new Map(list.map((loc) => [loc.id, loc]));
		const summaries: LocationSummary[] = [];
		const seen = new Set<number>();

		for (const id of ids) {
			if (seen.has(id)) continue;
			const match = lookup.get(id);
			if (match) {
				summaries.push({
					id: match.id,
					name: match.name,
					color: match.color
				});
			} else {
				summaries.push({
					id,
					name: `Plats ${id}`,
					color: null
				});
			}
			seen.add(id);
		}

		return summaries;
	});

	const selectedLocationIdSet = $derived.by(() => new Set(selectedLocationIds));

	const hasNonTrainerFilters = $derived.by(() => {
		const locationFiltersActive =
			Array.isArray(filters?.locationIds) && filters.locationIds.length > 0;
		const clientFiltersActive =
			Array.isArray(filters?.clientIds) && filters.clientIds.length > 0;
		const userFiltersActive =
			Array.isArray(filters?.userIds) && filters.userIds.length > 0;
		const roomFilterActive = filters?.roomId != null;
		return locationFiltersActive || clientFiltersActive || userFiltersActive || roomFilterActive;
	});

	const hasNonLocationFilters = $derived.by(() => {
		const trainerFiltersActive =
			Array.isArray(filters?.trainerIds) && filters.trainerIds.length > 0;
		const clientFiltersActive =
			Array.isArray(filters?.clientIds) && filters.clientIds.length > 0;
		const userFiltersActive =
			Array.isArray(filters?.userIds) && filters.userIds.length > 0;
		const roomFilterActive = filters?.roomId != null;
		const personalBookingsActive = Boolean(filters?.personalBookings);
		return (
			trainerFiltersActive ||
			clientFiltersActive ||
			userFiltersActive ||
			roomFilterActive ||
			personalBookingsActive
		);
	});

	const shouldSplitByLocation = $derived(
		singleDayView
			? selectedLocationSummaries.length > 1
			: selectedLocationSummaries.length > 0 && !hasNonLocationFilters
	);

	const shouldSplitByTrainer = $derived.by(() => {
		const count = trainerFilterCount;
		const trainerIds = filters?.trainerIds ?? null;
		if (count <= 1 || hasNonTrainerFilters) {
			return false;
		}
		if (singleDayView) {
			return count <= 5;
		}
		return count <= 5;
	});

	type LocationColumnView = {
		locationId: number | null;
		locationName: string;
		locationColor: string | null;
		layout: LayoutInfo[];
		emptySlots: { top: number; start: Date }[];
	};

	type TrainerColumnView = {
		trainerId: number | null;
		trainerName: string;
		trainerColor: string;
		layout: LayoutInfo[];
		emptySlots: { top: number; start: Date }[];
	};

	const locationColumnsByDay = $derived.by<LocationColumnView[][]>(() => {
		if (!shouldSplitByLocation) return [];
		return weekDays.map(({ fullDate }, dayIndex) => {
			const dayBookings = bookingsByDay[dayIndex] ?? [];
			const columns = selectedLocationSummaries.map((location) => {
				const locationBookings = dayBookings.filter(
					(booking) => (booking.location?.id ?? null) === location.id
				);
				return {
					locationId: location.id,
					locationName: location.name,
					locationColor: location.color,
					layout: layoutDayBookings(locationBookings),
					emptySlots: computeEmptySlotBlocks(
						fullDate,
						locationBookings,
						filters,
						availability
					)
				};
			});

			const leftoverBookings = dayBookings.filter((booking) => {
				const id = booking.location?.id ?? null;
				return !(id != null && selectedLocationIdSet.has(id));
			});

			if (leftoverBookings.length) {
				columns.push({
					locationId: null,
					locationName: 'Övriga',
					locationColor: '#94a3b8',
					layout: layoutDayBookings(leftoverBookings),
					emptySlots: []
				});
			}

			return columns;
		});
	});

	const trainerColumnsByDay = $derived.by<TrainerColumnView[][]>(() => {
		if (!shouldSplitByTrainer) {
			return [];
		}

		return weekDays.map(({ fullDate }, dayIndex) => {
			const dayBookings = bookingsByDay[dayIndex] ?? [];
			const buckets = new Map<number | null, FullBooking[]>();
			for (const trainer of selectedTrainerSummaries) {
				buckets.set(trainer.id, []);
			}
			buckets.set(null, []);

			for (const booking of dayBookings) {
				const bucketId = getTrainerBucketId(booking, selectedTrainerIdSet);
				const targetBucket = bucketId != null ? buckets.get(bucketId) : undefined;
				if (targetBucket) {
					targetBucket.push(booking);
				} else {
					const leftoverBucket = buckets.get(null);
					leftoverBucket?.push(booking);
				}
			}

			const columns = selectedTrainerSummaries.map((trainer) => {
				const trainerBookings = buckets.get(trainer.id) ?? [];
				return {
					trainerId: trainer.id,
					trainerName: trainer.name,
					trainerColor: trainer.color,
					layout: layoutDayBookings(trainerBookings),
					emptySlots: computeEmptySlotBlocks(fullDate, trainerBookings, filters, availability)
				};
			});

			const leftoverBookings = buckets.get(null) ?? [];
			if (leftoverBookings.length) {
				columns.push({
					trainerId: null,
					trainerName: 'Övriga',
					trainerColor: '#94a3b8',
					layout: layoutDayBookings(leftoverBookings),
					emptySlots: []
				});
			}

			return columns;
		});
	});

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

	type SlotDialogPinnedConfig = {
		mode: 'selected-slot';
		slot: SelectedSlot;
	};

	type SlotDialogConfig =
		| SlotDialogActionsConfig
		| SlotDialogSelectConfig
		| SlotDialogPinnedConfig;

	type SlotDialogView = {
		anchor: HTMLElement;
		config: SlotDialogConfig;
	};

let slotDialogView = $state<SlotDialogView | null>(null);
let suppressPinnedSlotRender = $state(false);

	function openSlotDialog(anchor: HTMLElement, config: SlotDialogConfig): boolean {
		if (!anchor || !anchor.isConnected) return false;
		slotDialogView = { anchor, config };
		return true;
	}

	$effect(() => {
		const view = slotDialogView;
		if (!view) return;
		if (view.config.mode === 'selected-slot') return;
		const locationIds = Array.isArray(filters?.locationIds) ? filters.locationIds : [];
		const targetedLocation = view.config.locationId;
		const singleLocationMatch =
			targetedLocation != null &&
			locationIds.length === 1 &&
			locationIds[0] === targetedLocation;
		const splitViewMatch =
			targetedLocation != null &&
			shouldSplitByLocation &&
			selectedLocationIdSet.has(targetedLocation);
		if (!singleLocationMatch && !splitViewMatch) {
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
		if (view.config.mode === 'selected-slot') return;
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

	function handlePinnedSlotResume(slot: SelectedSlot | null) {
		if (!slot) return;
		slotDialogView = null;
		dispatch('onPinnedSlotClick', { slot });
	}

	async function handlePinnedSlotClear() {
		suppressPinnedSlotRender = true;
		slotDialogView = null;
		await tick();
		clearSelectedSlot();
	}
$effect(() => {
	if (!pinnedSlotView) {
		suppressPinnedSlotRender = false;
	}
});

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
		const hasSingleLocationFilter =
			bookingLocationId != null &&
			locationIds.length === 1 &&
			locationIds[0] === bookingLocationId;
		const hasSplitLocationMatch =
			bookingLocationId != null &&
			shouldSplitByLocation &&
			selectedLocationIdSet.has(bookingLocationId);
		if (!hasSingleLocationFilter && !hasSplitLocationMatch) {
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

	function openBookingPopup(startTime: Date, locationId?: number | null, trainerId?: number | null) {
		dispatch('onTimeSlotClick', {
			startTime,
			locationId: locationId ?? null,
			trainerId: trainerId ?? null
		});
	}

	function handleDaySelection(fullDate: Date) {
		if (!fullDate) return;
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
		{#each weekDays as dayInfo, index (dayInfo.dateKey)}
			{@const isToday = isSameLocalDay(dayInfo.fullDate, new Date())}
			{@const tooltipContent = dayInfo.isHoliday
				? [dayInfo.holidayName].filter(Boolean).join('\n')
				: ''}
			<div
				class="flex flex-col items-center text-white transition-colors focus:outline-none"
				class:mx-1={!isMobile}
				class:mx-0={isMobile}
				class:py-2={!isMobile}
				class:py-1={isMobile}
				class:rounded-sm={!isMobile}
				class:rounded-none={isMobile}
				class:border-r={isCompactWeek}
				class:border-white={isCompactWeek}
				class:border-opacity-40={isCompactWeek}
				class:border-r-0={isCompactWeek && index === weekDays.length - 1}
				class:cursor-pointer={!singleDayView}
				class:bg-orange={isToday}
				class:bg-red-bright={!isToday && dayInfo.isHoliday}
				class:text-red-bright={isToday && dayInfo.isHoliday}
				class:bg-gray-dark={!dayInfo.isHoliday && dayInfo.isWeekend && !isToday}
				class:bg-gray={!dayInfo.isHoliday && !dayInfo.isWeekend && !isToday}
				use:tooltip={dayInfo.isHoliday && tooltipContent ? { content: tooltipContent } : undefined}
				on:click={() => handleDaySelection(dayInfo.fullDate)}
			>
				<p
					class="capitalize"
					class:text-lg={!isMobile}
					class:text-xs={isMobile}
					class:tracking-wide={isMobile}
				>
					{isCompactWeek ? dayInfo.dayShortLabel : dayInfo.dayLabel}
				</p>
				<p
					class="leading-tight font-semibold"
					class:text-4xl={!isMobile}
					class:text-base={isMobile}
				>
					{dayInfo.dateLabel}
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
		{#each weekDays as dayInfo, dayIndex}
			{@const pinnedSlotForDay =
				pinnedSlotView && pinnedSlotView.dayIndex === dayIndex ? pinnedSlotView : null}
			{@const pinnedSlotBooking = pinnedSlotForDay?.booking}
			<div
				class="border-gray-bright relative flex flex-col gap-1 border-l"
				class:gap-0.5={isCompactWeek}
				class:pt-8={dayInfo.isHoliday}
			>
				{#if pinnedSlotForDay && pinnedSlotBooking && !suppressPinnedSlotRender}
					<BookingSlot
						booking={pinnedSlotBooking}
						{startHour}
						{hourHeight}
						columnIndex={pinnedSlotForDay.columnIndex ?? 0}
						columnCount={pinnedSlotForDay.columnCount ?? 1}
						variant="selected"
						toolTipText={`Vald tid ${pinnedSlotForDay.slot.time ?? ''}`}
						clearLabel="Rensa vald tid"
						onclear={handlePinnedSlotClear}
						onbookingselected={(event) => {
							event.preventDefault();
							event.stopPropagation();
								const anchor = event.currentTarget as HTMLElement | null;
								const opened = anchor
									? openSlotDialog(anchor, { mode: 'selected-slot', slot: pinnedSlotForDay.slot })
									: false;
								if (!opened) {
									handlePinnedSlotResume(pinnedSlotForDay.slot);
								}
							}}
						/>
				{/if}
				{#each unavailableBlocksByDay[dayIndex] ?? [] as block}
					<div
						class="unavailable-striped absolute right-0 left-0"
						style="top: {block.top}px; height: {block.height}px; z-index: 0;"
					/>
				{/each}

				{#if shouldSplitByLocation}
					<div class="flex h-full gap-1">
						{#each locationColumnsByDay[dayIndex] ?? [] as column, columnIndex (column.locationId ?? `unknown-${columnIndex}`)}
							{@const locationHeaderLabel = getLocationShortLabel(column.locationName)}
							{@const locationHeaderTitle = column.locationName ?? 'Plats'}
							<div class="flex basis-0 flex-1 flex-col" class:gap-1={singleDayView} class:gap-0={!singleDayView}>
								{#if singleDayView}
									<div
										class="calendar-location-header text-gray-dark flex items-center justify-center rounded border border-gray-bright/70 bg-white/80 px-2 py-1 text-xs font-semibold"
										style="border-color: {column.locationColor ?? '#e2e8f0'};"
										title={locationHeaderTitle}
									>
										<span
											class="truncate tracking-wide"
											class:uppercase={isMobile}
										>
											{locationHeaderLabel}
										</span>
									</div>
								{/if}
								<div class="relative flex-1">
									{#each column.emptySlots as slot}
										<button
											class="hover:bg-orange/20 absolute right-0 left-0 cursor-pointer"
											style="top: {slot.top}px; height: {hourHeight}px; z-index: 0;"
											on:click={() => openBookingPopup(slot.start, column.locationId)}
											use:tooltip={{
												content: `${slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(slot.start.getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
											}}
										>
										</button>
									{/each}
									{#each column.layout ?? [] as layoutItem (layoutItem.booking.booking.id)}
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
							</div>
						{/each}
					</div>
				{:else if shouldSplitByTrainer}
					<div class="flex h-full gap-1">
						{#each trainerColumnsByDay[dayIndex] ?? [] as column, columnIndex (column.trainerId ?? `trainer-${columnIndex}`)}
							{@const trainerHeaderTitle = column.trainerName ?? 'Tränare'}
							<div class="flex basis-0 flex-1 flex-col" class:gap-1={singleDayView}>
								{#if singleDayView}
									<div
										class="calendar-location-header flex items-center justify-center rounded border border-gray-bright/70 bg-white/80 px-2 py-1 text-gray-dark text-xs font-semibold"
										title={trainerHeaderTitle}
										style={`border-color: ${column.trainerColor ?? '#e2e8f0'};`}
									>
										<span class="truncate tracking-wide">
											{trainerHeaderTitle}
										</span>
									</div>
								{/if}
								<div class="relative flex-1">
									{#each column.emptySlots as slot}
										<button
											class="hover:bg-orange/20 absolute right-0 left-0 cursor-pointer"
											style="top: {slot.top}px; height: {hourHeight}px; z-index: 0;"
											on:click={() => openBookingPopup(slot.start, null, column.trainerId)}
											use:tooltip={{
												content: `${slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(slot.start.getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
											}}
										>
										</button>
									{/each}
									{#each column.layout ?? [] as layoutItem (layoutItem.booking.booking.id)}
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
							</div>
						{/each}
					</div>
				{:else}
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
					{#each layoutByDay[dayIndex] ?? [] as layoutItem (layoutItem.booking.booking.id)}
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
				{/if}
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
			on:pinnedSlotClear={() => {
				slotDialogView = null;
				handlePinnedSlotClear();
			}}
			on:pinnedSlotBook={(event) => {
				slotDialogView = null;
				handlePinnedSlotResume(event.detail.slot);
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

	.calendar-location-header {
		position: sticky;
		top: 0;
		z-index: 5;
		backdrop-filter: blur(2px);
	}
</style>
