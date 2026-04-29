<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { get } from 'svelte/store';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import type {
		CalendarFilters,
		CalendarAvailability,
		CalendarBlockedDays,
		CalendarBlockedDayReason
	} from '$lib/stores/calendarStore';
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

	type AvailabilitySlots = { from: string; to: string }[] | null;
	type UnavailableBlock = {
		top: number;
		height: number;
		label?: string;
		reason?: CalendarBlockedDayReason;
	};
	type LayoutInfo = {
		booking: FullBooking;
		columnIndex: number;
		columnCount: number;
	};
	type TimestampRange = {
		startMs: number;
		endMs: number;
	};
	type MinuteRange = {
		startMin: number;
		endMin: number;
	};
	type ResolvedDayAvailability = {
		trainerId: number | null;
		blockedReason: CalendarBlockedDayReason | null;
		availableRanges: MinuteRange[] | null;
	};
	type DaySlotRenderState = {
		emptySlots: { top: number; start: Date }[];
		unavailableBlocks: UnavailableBlock[];
	};

	let calendarContainer: HTMLDivElement | null = null;

	// Access store data directly in derived values
	const storeValue = $derived($calendarStore);
	const pinnedSlot = $derived($selectedSlot);
	const bookings = $derived(storeValue.bookings);
	const filters = $derived(storeValue.filters);
	const availability = $derived(storeValue.availability);
	const blockedDays = $derived(storeValue.blockedDays);
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
	const hourLineOffsets = $derived.by(() =>
		Array.from({ length: totalHours + 1 }, (_, i) => i * hourHeight)
	);
	const halfHourLineOffsets = $derived.by(() =>
		Array.from({ length: totalHours }, (_, i) => i * hourHeight + hourHeight / 2)
	);
	const hourBandOffsets = $derived.by(() =>
		Array.from({ length: totalHours }, (_, i) => i * hourHeight + hourHeight / 2)
	);

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

	type ClientSummary = {
		id: number;
		name: string;
		initials: string;
		color: string;
	};

	type SplitLaneSummary =
		| {
				key: string;
				kind: 'trainer';
				id: number;
				title: string;
				shortLabel: string;
				accentColor: string;
		  }
		| {
				key: string;
				kind: 'location';
				id: number;
				title: string;
				shortLabel: string;
				accentColor: string | null;
		  }
		| {
				key: string;
				kind: 'client';
				id: number;
				title: string;
				shortLabel: string;
				accentColor: string;
		  };

	type SplitColumnView = {
		key: string;
		kind: SplitLaneSummary['kind'];
		title: string;
		shortLabel: string;
		accentColor: string | null;
		layout: LayoutInfo[];
		unavailableBlocks: UnavailableBlock[];
		emptySlots: { top: number; start: Date }[];
		locationId: number | null;
		trainerId: number | null;
		clientId: number | null;
	};

	const MAX_SPLIT_FILTERS = 6;

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

	function getClientColor(id: number): string {
		if (!Number.isFinite(id)) return '#94a3b8';
		const index = Math.abs(Math.trunc(id) + 3) % trainerColorPalette.length;
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

	const selectedClientIds = $derived(
		Array.isArray(filters?.clientIds)
			? filters.clientIds.filter((id): id is number => typeof id === 'number')
			: []
	);

	function buildClientSummaryName(first?: string | null, last?: string | null, id?: number) {
		const firstName = first?.trim() ?? '';
		const lastName = last?.trim() ?? '';
		const combined = `${firstName} ${lastName}`.trim();
		if (combined) return combined;
		if (firstName || lastName) return firstName || lastName;
		return id != null ? `Kund ${id}` : 'Kund';
	}

	function buildClientInitials(first?: string | null, last?: string | null, id?: number) {
		const firstLetter = first?.trim()?.[0];
		const lastLetter = last?.trim()?.[0];
		if (firstLetter && lastLetter) return `${firstLetter}${lastLetter}`.toUpperCase();
		if (firstLetter) return firstLetter.toUpperCase();
		if (lastLetter) return lastLetter.toUpperCase();
		return id != null ? `K${id}` : 'KU';
	}

	const selectedClientSummaries = $derived.by<ClientSummary[]>(() => {
		const ids = selectedClientIds;
		if (!ids.length) return [];
		const infoLookup = new Map<number, { name: string; initials: string }>();
		for (const booking of bookings) {
			const client = booking.client;
			if (!client?.id || infoLookup.has(client.id)) continue;
			infoLookup.set(client.id, {
				name: buildClientSummaryName(client.firstname, client.lastname, client.id),
				initials: buildClientInitials(client.firstname, client.lastname, client.id)
			});
		}

		const summaries: ClientSummary[] = [];
		const seen = new Set<number>();
		for (const id of ids) {
			if (seen.has(id)) continue;
			const info = infoLookup.get(id);
			summaries.push({
				id,
				name: info?.name ?? `Kund ${id}`,
				initials: info?.initials ?? `K${id}`,
				color: getClientColor(id)
			});
			seen.add(id);
		}
		return summaries;
	});

	const selectedTrainerIdSet = $derived.by(() => new Set(selectedTrainerIds));
	const selectedClientIdSet = $derived.by(() => new Set(selectedClientIds));

	function getMatchingTrainerSelectionIds(
		booking: FullBooking,
		allowedTrainerIds: Set<number>
	): number[] {
		if (allowedTrainerIds.size === 0) return [];

		const matches: number[] = [];
		const seen = new Set<number>();
		const addMatch = (value: unknown) => {
			const numericId = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
			if (!Number.isFinite(numericId) || seen.has(numericId) || !allowedTrainerIds.has(numericId)) {
				return;
			}
			seen.add(numericId);
			matches.push(numericId);
		};

		addMatch(booking.trainer?.id ?? null);

		if (Boolean(booking.booking.internalEducation) || Boolean(booking.additionalInfo?.education)) {
			addMatch(booking.trainee?.id ?? booking.booking.userId ?? null);
		}

		if (booking.isPersonalBooking) {
			const personalIds = booking.personalBooking?.userIds ?? [];
			if (Array.isArray(personalIds)) {
				for (const personalId of personalIds) {
					addMatch(personalId);
				}
			}
		}

		return matches;
	}

	function createSplitLaneBookingBuckets(lanes: SplitLaneSummary[]) {
		return new Map<string, FullBooking[]>(lanes.map((lane) => [lane.key, []]));
	}

	const splitLaneSummaries = $derived.by<SplitLaneSummary[]>(() => [
		...selectedTrainerSummaries.map((trainer) => ({
			key: `trainer-${trainer.id}`,
			kind: 'trainer' as const,
			id: trainer.id,
			title: trainer.name,
			shortLabel: trainer.initials,
			accentColor: trainer.color
		})),
		...selectedLocationSummaries.map((location) => ({
			key: `location-${location.id}`,
			kind: 'location' as const,
			id: location.id,
			title: location.name,
			shortLabel: getLocationShortLabel(location.name),
			accentColor: location.color
		})),
		...selectedClientSummaries.map((client) => ({
			key: `client-${client.id}`,
			kind: 'client' as const,
			id: client.id,
			title: client.name,
			shortLabel: client.initials,
			accentColor: client.color
		}))
	]);

	const shouldSplitBySelectedFilters = $derived.by(() => {
		const count = splitLaneSummaries.length;
		return count > 0 && count <= MAX_SPLIT_FILTERS;
	});

	const hasSplitTrainerLane = $derived.by(
		() => shouldSplitBySelectedFilters && selectedTrainerSummaries.length > 0
	);
	const hasSplitLocationLane = $derived.by(
		() => shouldSplitBySelectedFilters && selectedLocationSummaries.length > 0
	);
	const showSplitHeaders = $derived.by(
		() => shouldSplitBySelectedFilters && splitLaneSummaries.length > 1
	);

	let splitHeaderProbeHeight = $state(0);

	const splitHeaderOffset = $derived.by(() =>
		showSplitHeaders ? splitHeaderProbeHeight + (singleDayView ? 4 : 0) : 0
	);

	const splitColumnsByDay = $derived.by<SplitColumnView[][]>(() => {
		if (!shouldSplitBySelectedFilters) return [];

		return weekDays.map(({ fullDate }, dayIndex) => {
			const dayBookings = bookingsByDay[dayIndex] ?? [];
			const laneBookings = createSplitLaneBookingBuckets(splitLaneSummaries);

			for (const booking of dayBookings) {
				for (const trainerId of getMatchingTrainerSelectionIds(booking, selectedTrainerIdSet)) {
					laneBookings.get(`trainer-${trainerId}`)?.push(booking);
				}

				const locationId = booking.location?.id ?? null;
				if (locationId != null && selectedLocationIdSet.has(locationId)) {
					laneBookings.get(`location-${locationId}`)?.push(booking);
				}

				const clientId = booking.client?.id ?? null;
				if (clientId != null && selectedClientIdSet.has(clientId)) {
					laneBookings.get(`client-${clientId}`)?.push(booking);
				}
			}

			return splitLaneSummaries.map((lane) => {
				if (lane.kind === 'trainer') {
					const trainerBookings = laneBookings.get(lane.key) ?? [];
					const slotRenderState = buildDaySlotRenderState(
						fullDate,
						trainerBookings,
						filters,
						availability,
						blockedDays,
						lane.id
					);
					return {
						key: lane.key,
						kind: lane.kind,
						title: lane.title,
						shortLabel: lane.shortLabel,
						accentColor: lane.accentColor,
						layout: layoutDayBookings(trainerBookings),
						unavailableBlocks: slotRenderState.unavailableBlocks,
						emptySlots: slotRenderState.emptySlots,
						locationId: null,
						trainerId: lane.id,
						clientId: null
					};
				}

				if (lane.kind === 'location') {
					const locationBookings = laneBookings.get(lane.key) ?? [];
					const slotRenderState = buildDaySlotRenderState(
						fullDate,
						locationBookings,
						filters,
						availability,
						blockedDays
					);
					return {
						key: lane.key,
						kind: lane.kind,
						title: lane.title,
						shortLabel: lane.shortLabel,
						accentColor: lane.accentColor,
						layout: layoutDayBookings(locationBookings),
						unavailableBlocks: slotRenderState.unavailableBlocks,
						emptySlots: slotRenderState.emptySlots,
						locationId: lane.id,
						trainerId: null,
						clientId: null
					};
				}

				const clientBookings = laneBookings.get(lane.key) ?? [];
				const slotRenderState = buildDaySlotRenderState(
					fullDate,
					clientBookings,
					filters,
					availability,
					blockedDays
				);
				return {
					key: lane.key,
					kind: lane.kind,
					title: lane.title,
					shortLabel: lane.shortLabel,
					accentColor: lane.accentColor,
					layout: layoutDayBookings(clientBookings),
					unavailableBlocks: slotRenderState.unavailableBlocks,
					emptySlots: slotRenderState.emptySlots,
					locationId: null,
					trainerId: null,
					clientId: lane.id
				};
			});
		});
	});

	const daySlotRenderStateByDay = $derived.by(() =>
		weekDays.map(({ fullDate }, idx) =>
			buildDaySlotRenderState(
				fullDate,
				bookingsByDay[idx] ?? [],
				filters,
				availability,
				blockedDays
			)
		)
	);

	const emptySlotBlocksByDay = $derived.by(() =>
		daySlotRenderStateByDay.map(({ emptySlots }) => emptySlots)
	);

	const unavailableBlocksByDay = $derived.by(() =>
		daySlotRenderStateByDay.map(({ unavailableBlocks }) => unavailableBlocks)
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

	type SlotDialogConfig = SlotDialogActionsConfig | SlotDialogSelectConfig | SlotDialogPinnedConfig;

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
			targetedLocation != null && locationIds.length === 1 && locationIds[0] === targetedLocation;
		const splitViewMatch =
			targetedLocation != null &&
			hasSplitLocationLane &&
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

	function parseTimeToMinutes(value: string): number | null {
		const [hours, minutes] = value.split(':').map(Number);
		if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
			return null;
		}
		return hours * 60 + minutes;
	}

	function normalizeMinuteRanges(ranges: MinuteRange[]): MinuteRange[] {
		if (ranges.length <= 1) {
			return ranges;
		}

		const sorted = [...ranges].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
		const merged: MinuteRange[] = [{ ...sorted[0] }];

		for (let index = 1; index < sorted.length; index += 1) {
			const current = sorted[index];
			const previous = merged[merged.length - 1];
			if (!previous || current.startMin > previous.endMin) {
				merged.push({ ...current });
				continue;
			}
			previous.endMin = Math.max(previous.endMin, current.endMin);
		}

		return merged;
	}

	function buildBookingTimestampRanges(bookingsForDay: FullBooking[]): TimestampRange[] {
		return bookingsForDay
			.map((booking) => ({
				startMs: getStart(booking),
				endMs: getEnd(booking)
			}))
			.filter(
				(range): range is TimestampRange =>
					Number.isFinite(range.startMs) &&
					Number.isFinite(range.endMs) &&
					range.endMs > range.startMs
			)
			.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
	}

	function resolveAvailableMinuteRanges(
		dayAvailability: AvailabilitySlots | undefined
	): MinuteRange[] | null {
		if (dayAvailability == null) {
			return null;
		}

		if (!Array.isArray(dayAvailability) || dayAvailability.length === 0) {
			return [];
		}

		const parsed = dayAvailability
			.map((slot) => {
				const startMin = parseTimeToMinutes(slot.from);
				const endMin = parseTimeToMinutes(slot.to);
				if (startMin == null || endMin == null || endMin <= startMin) {
					return null;
				}
				return { startMin, endMin };
			})
			.filter((range): range is MinuteRange => range != null);

		return normalizeMinuteRanges(parsed);
	}

	function layoutDayBookings(bookingsForDay: FullBooking[]): LayoutInfo[] {
		const sortedBookings = [...bookingsForDay].sort((a, b) => getStart(a) - getStart(b));
		const results: LayoutInfo[] = [];
		const layoutByBooking = new Map<FullBooking, LayoutInfo>();
		let active: { layout: LayoutInfo; endTime: number }[] = [];

		for (const booking of sortedBookings) {
			const start = getStart(booking);
			const end = getEnd(booking);

			active = active.filter((a) => a.endTime > start);

			const usedColumns = new Set(active.map((item) => item.layout.columnIndex));
			let columnIndex = 0;
			while (usedColumns.has(columnIndex)) {
				columnIndex += 1;
			}

			const layout: LayoutInfo = {
				booking,
				columnIndex,
				columnCount: active.length + 1
			};
			layoutByBooking.set(booking, layout);
			results.push(layout);
			active.push({ layout, endTime: end });

			const concurrency = active.length;
			for (const item of active) {
				const activeLayout = layoutByBooking.get(item.layout.booking);
				if (!activeLayout) continue;
				activeLayout.columnCount = Math.max(activeLayout.columnCount, concurrency);
			}
		}

		return results;
	}

	function shouldShowSplitSlotTime(
		columns: SplitColumnView[],
		columnIndex: number,
		slotStart: Date
	): boolean {
		const slotTime = slotStart.getTime();
		for (let index = 0; index < columnIndex; index += 1) {
			const previousColumn = columns[index];
			if (!previousColumn) continue;
			const alreadyShown = previousColumn.emptySlots.some(
				(candidate) => candidate.start.getTime() === slotTime
			);
			if (alreadyShown) {
				return false;
			}
		}
		return true;
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
			bookingLocationId != null && locationIds.length === 1 && locationIds[0] === bookingLocationId;
		const hasSplitLocationMatch =
			bookingLocationId != null &&
			hasSplitLocationLane &&
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

	function resolveAvailabilityTrainerId(
		currentFilters: CalendarFilters | undefined,
		trainerId?: number | null
	): number | null {
		if (typeof trainerId === 'number' && Number.isFinite(trainerId)) {
			return trainerId;
		}

		const trainerIds = Array.isArray(currentFilters?.trainerIds)
			? currentFilters.trainerIds.filter((id): id is number => typeof id === 'number')
			: [];

		return trainerIds.length === 1 ? trainerIds[0] : null;
	}

	function getBlockedDayLabel(reason: CalendarBlockedDayReason): string {
		return reason === 'vacation' ? 'Semester' : 'Frånvaro';
	}

	function getDayAvailabilityState(
		dayDateInput: Date,
		currentFilters: CalendarFilters | undefined,
		availabilityByTrainer: CalendarAvailability,
		blockedDaysByTrainer: CalendarBlockedDays,
		trainerId?: number | null
	): {
		trainerId: number | null;
		dayAvailability: AvailabilitySlots | undefined;
		blockedReason: CalendarBlockedDayReason | null;
	} {
		const targetTrainerId = resolveAvailabilityTrainerId(currentFilters, trainerId);
		if (targetTrainerId == null) {
			return {
				trainerId: null,
				dayAvailability: undefined,
				blockedReason: null
			};
		}

		const dayDate = new Date(dayDateInput);
		dayDate.setHours(0, 0, 0, 0);
		const dateStr = ymdLocal(dayDate);

		return {
			trainerId: targetTrainerId,
			dayAvailability: availabilityByTrainer?.[targetTrainerId]?.[dateStr],
			blockedReason: blockedDaysByTrainer?.[targetTrainerId]?.[dateStr] ?? null
		};
	}

	function resolveDayAvailability(
		dayDateInput: Date,
		currentFilters: CalendarFilters | undefined,
		availabilityByTrainer: CalendarAvailability,
		blockedDaysByTrainer: CalendarBlockedDays,
		trainerId?: number | null
	): ResolvedDayAvailability {
		const {
			trainerId: activeTrainerId,
			dayAvailability,
			blockedReason
		} = getDayAvailabilityState(
			dayDateInput,
			currentFilters,
			availabilityByTrainer,
			blockedDaysByTrainer,
			trainerId
		);

		return {
			trainerId: activeTrainerId,
			blockedReason,
			availableRanges: resolveAvailableMinuteRanges(dayAvailability)
		};
	}

	function buildUnavailableBlocksFromAvailability(
		availabilityState: ResolvedDayAvailability
	): UnavailableBlock[] {
		const blocks: UnavailableBlock[] = [];

		if (availabilityState.trainerId == null) {
			return blocks;
		}

		if (availabilityState.blockedReason) {
			return [
				{
					top: 0,
					height: totalHours * hourHeight,
					label: getBlockedDayLabel(availabilityState.blockedReason),
					reason: availabilityState.blockedReason
				}
			];
		}

		const availableRanges = availabilityState.availableRanges;
		if (availableRanges == null) {
			return blocks;
		}

		if (availableRanges.length === 0) {
			blocks.push({ top: 0, height: totalHours * hourHeight });
			return blocks;
		}

		const dayStartMin = startHour * 60;
		const dayEndMin = (startHour + totalHours) * 60;
		let cursor = dayStartMin;

		for (const range of availableRanges) {
			const slotStartMin = Math.max(range.startMin, dayStartMin);
			const slotEndMin = Math.min(range.endMin, dayEndMin);
			if (slotEndMin <= dayStartMin || slotStartMin >= dayEndMin) {
				continue;
			}

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

	function buildEmptySlotBlocksFromState(
		dayDate: Date,
		bookingRanges: TimestampRange[],
		availabilityState: ResolvedDayAvailability
	): { top: number; start: Date }[] {
		const results: { top: number; start: Date }[] = [];

		if (availabilityState.blockedReason) {
			return results;
		}

		const dayStartMs = dayDate.getTime();
		const availableRanges = availabilityState.availableRanges;
		let bookingIndex = 0;
		let availabilityIndex = 0;

		for (let slotIndex = 0; slotIndex < totalHours - 1; slotIndex += 1) {
			const slotStartMin = (startHour + slotIndex) * 60 + 30;
			const slotEndMin = slotStartMin + 60;
			const slotStartMs = dayStartMs + slotStartMin * 60 * 1000;
			const slotEndMs = dayStartMs + slotEndMin * 60 * 1000;

			while (
				bookingIndex < bookingRanges.length &&
				bookingRanges[bookingIndex].endMs <= slotStartMs
			) {
				bookingIndex += 1;
			}

			const currentBooking = bookingRanges[bookingIndex];
			const isOccupied = Boolean(
				currentBooking && currentBooking.startMs < slotEndMs && currentBooking.endMs > slotStartMs
			);

			let isAvailable = true;
			if (availabilityState.trainerId != null && availableRanges != null) {
				if (availableRanges.length === 0) {
					isAvailable = false;
				} else {
					while (
						availabilityIndex < availableRanges.length &&
						availableRanges[availabilityIndex].endMin <= slotStartMin
					) {
						availabilityIndex += 1;
					}

					const currentAvailability = availableRanges[availabilityIndex];
					isAvailable = Boolean(
						currentAvailability &&
							slotStartMin >= currentAvailability.startMin &&
							slotEndMin <= currentAvailability.endMin
					);
				}
			}

			if (!isOccupied && isAvailable) {
				results.push({
					top: (slotIndex * 2 + 1) * (hourHeight / 2),
					start: new Date(slotStartMs)
				});
			}
		}

		return results;
	}

	function buildDaySlotRenderState(
		dayDateInput: Date,
		dayBookings: FullBooking[],
		currentFilters: CalendarFilters | undefined,
		availabilityByTrainer: CalendarAvailability,
		blockedDaysByTrainer: CalendarBlockedDays,
		trainerId?: number | null
	): DaySlotRenderState {
		if (!dayDateInput) {
			return { emptySlots: [], unavailableBlocks: [] };
		}

		const dayDate = new Date(dayDateInput);
		dayDate.setHours(0, 0, 0, 0);
		const availabilityState = resolveDayAvailability(
			dayDate,
			currentFilters,
			availabilityByTrainer,
			blockedDaysByTrainer,
			trainerId
		);

		const bookingRanges = buildBookingTimestampRanges(dayBookings);
		return {
			emptySlots: buildEmptySlotBlocksFromState(dayDate, bookingRanges, availabilityState),
			unavailableBlocks: buildUnavailableBlocksFromAvailability(availabilityState)
		};
	}

	function openBookingPopup(
		startTime: Date,
		locationId?: number | null,
		trainerId?: number | null,
		clientId?: number | null
	) {
		dispatch('onTimeSlotClick', {
			startTime,
			locationId: locationId ?? null,
			trainerId: trainerId ?? null,
			clientId: clientId ?? null
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
	{#if showSplitHeaders}
		<div class="pointer-events-none absolute -z-10 opacity-0" aria-hidden="true">
			<div
				bind:offsetHeight={splitHeaderProbeHeight}
				class="text-gray-dark border-gray-bright/70 flex min-w-0 overflow-hidden rounded border bg-white/80 text-xs font-semibold"
				class:px-2={singleDayView}
				class:px-1={!singleDayView}
				class:py-1={singleDayView}
				class:py-0.5={!singleDayView}
			>
				<span class="block min-w-0 flex-1 truncate text-center tracking-wide">TT</span>
			</div>
		</div>
	{/if}
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
				class="text-gray-dark pointer-events-none absolute top-30 right-10 z-10 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium shadow-xs"
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
		<CurrentTimeIndicator {startHour} {hourHeight} topOffset={splitHeaderOffset} />

		<div
			class="relative flex flex-col items-center"
			style={showSplitHeaders ? `padding-top: ${splitHeaderOffset}px;` : undefined}
		>
			<CurrentTimePill {startHour} {hourHeight} topOffset={splitHeaderOffset} />
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
			>
				{#if pinnedSlotForDay && pinnedSlotBooking && !suppressPinnedSlotRender}
					<BookingSlot
						booking={pinnedSlotBooking}
						{startHour}
						{hourHeight}
						columnIndex={pinnedSlotForDay.columnIndex ?? 0}
						columnCount={pinnedSlotForDay.columnCount ?? 1}
						variant="selected"
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
				{#if !hasSplitTrainerLane}
					{#each unavailableBlocksByDay[dayIndex] ?? [] as block}
						<div
							class="unavailable-striped absolute right-0 left-0"
							class:unavailable-striped--blocked={Boolean(block.label)}
							style="top: {block.top}px; height: {block.height}px; z-index: 0;"
							aria-label={block.label}
						>
							{#if block.label}
								<span class="calendar-unavailable-label">{block.label}</span>
							{/if}
						</div>
					{/each}
				{/if}

				{#if shouldSplitBySelectedFilters}
					{@const dayColumns = splitColumnsByDay[dayIndex] ?? []}
					<div class="flex h-full" class:gap-1={singleDayView} class:gap-0={!singleDayView}>
						{#each dayColumns as column, columnIndex (column.key)}
							{@const headerText = singleDayView
								? column.kind === 'location' || isMobile
									? column.shortLabel
									: column.title
								: column.shortLabel}
							<div
								class="flex min-w-0 flex-1 basis-0 flex-col"
								class:gap-1={singleDayView && showSplitHeaders}
								class:gap-0={!singleDayView || !showSplitHeaders}
							>
								{#if showSplitHeaders}
									<div
										class="calendar-location-header text-gray-dark border-gray-bright/70 flex min-w-0 overflow-hidden rounded border bg-white/80 text-xs font-semibold"
										class:px-2={singleDayView}
										class:px-1={!singleDayView}
										class:py-1={singleDayView}
										class:py-0.5={!singleDayView}
										style="border-color: {column.accentColor ?? '#e2e8f0'};"
										use:tooltip={!singleDayView
											? { content: column.title, preferred: 'top' }
											: undefined}
									>
										<span
											class="block min-w-0 flex-1 truncate text-center tracking-wide"
											class:uppercase={isMobile || !singleDayView}
										>
											{headerText}
										</span>
									</div>
								{/if}
								<div class="relative flex-1">
									<div class="calendar-time-bands">
										{#each hourBandOffsets as top, index}
											<div
												class="calendar-hour-band"
												class:calendar-hour-band--alt={index % 2 === 1}
												style={`top: ${top}px; height: ${hourHeight}px;`}
											/>
										{/each}
									</div>
									<div class="calendar-time-lines">
										{#each hourLineOffsets as top}
											<div class="calendar-hour-line" style={`top: ${top}px;`} />
										{/each}
										{#each halfHourLineOffsets as top}
											<div class="calendar-half-hour-line" style={`top: ${top}px;`} />
										{/each}
									</div>
									{#each column.unavailableBlocks ?? [] as block}
										<div
											class="unavailable-striped absolute right-0 left-0"
											class:unavailable-striped--blocked={Boolean(block.label)}
											style="top: {block.top}px; height: {block.height}px; z-index: 0;"
											aria-label={block.label}
										>
											{#if block.label}
												<span class="calendar-unavailable-label">{block.label}</span>
											{/if}
										</div>
									{/each}
									{#each column.emptySlots as slot}
										<button
											class="hover:bg-orange/20 absolute right-0 left-0 cursor-pointer"
											style="top: {slot.top}px; height: {hourHeight}px; z-index: 0;"
											on:click={() =>
												openBookingPopup(
													slot.start,
													column.locationId,
													column.trainerId,
													column.clientId
												)}
											use:tooltip={{
												content: `${slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(slot.start.getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
											}}
										>
											{#if singleDayView || shouldShowSplitSlotTime(dayColumns, columnIndex, slot.start)}
												<span class="empty-slot-time">
													{slot.start.toLocaleTimeString([], {
														hour: '2-digit',
														minute: '2-digit'
													})}
												</span>
											{/if}
										</button>
									{/each}
									{#each column.layout ?? [] as layoutItem (layoutItem.booking.booking.id)}
										<BookingSlot
											booking={layoutItem.booking}
											{startHour}
											{hourHeight}
											columnIndex={layoutItem.columnIndex}
											columnCount={layoutItem.columnCount}
											onbookingselected={(event) =>
												handleBookingSlotClick(event, layoutItem.booking)}
										/>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="calendar-time-bands">
						{#each hourBandOffsets as top, index}
							<div
								class="calendar-hour-band"
								class:calendar-hour-band--alt={index % 2 === 1}
								style={`top: ${top}px; height: ${hourHeight}px;`}
							/>
						{/each}
					</div>
					<div class="calendar-time-lines">
						{#each hourLineOffsets as top}
							<div class="calendar-hour-line" style={`top: ${top}px;`} />
						{/each}
						{#each halfHourLineOffsets as top}
							<div class="calendar-half-hour-line" style={`top: ${top}px;`} />
						{/each}
					</div>
					{#each emptySlotBlocksByDay[dayIndex] ?? [] as slot}
						<button
							class="hover:bg-orange/20 absolute right-0 left-0 cursor-pointer"
							style="top: {slot.top}px; height: {hourHeight}px; z-index: 0;"
							on:click={() => openBookingPopup(slot.start)}
							use:tooltip={{
								content: `${slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(slot.start.getTime() + 60 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
							}}
						>
							<span class="empty-slot-time">
								{slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
							</span>
						</button>
					{/each}
					{#each layoutByDay[dayIndex] ?? [] as layoutItem (layoutItem.booking.booking.id)}
						<BookingSlot
							booking={layoutItem.booking}
							{startHour}
							{hourHeight}
							columnIndex={layoutItem.columnIndex}
							columnCount={layoutItem.columnCount}
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

	.unavailable-striped--blocked {
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.calendar-unavailable-label {
		max-width: calc(100% - 1rem);
		border: 1px solid rgba(185, 28, 28, 0.14);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.88);
		padding: 0.25rem 0.625rem;
		color: rgba(127, 29, 29, 0.92);
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1.1;
		text-align: center;
	}

	.calendar-time-bands {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 0;
		overflow: hidden;
	}

	.calendar-hour-band {
		position: absolute;
		left: 0;
		right: 0;
		background: transparent;
	}

	.calendar-hour-band--alt {
		background-color: rgba(61, 61, 61, 0.065);
	}

	.calendar-time-lines {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 1;
	}

	.calendar-hour-line,
	.calendar-half-hour-line {
		position: absolute;
		left: 0;
		right: 0;
	}

	.calendar-half-hour-line {
		border-top: 1px solid rgba(148, 163, 184, 0.2);
	}

	.calendar-location-header {
		position: sticky;
		top: 0;
		z-index: 5;
		backdrop-filter: blur(2px);
	}

	.empty-slot-time {
		position: absolute;
		top: 2px;
		left: 4px;
		font-size: 10px;
		color: rgba(100, 116, 139, 0.6);
		pointer-events: none;
		font-weight: 500;
		letter-spacing: 0.02em;
	}
</style>
