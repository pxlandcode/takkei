<script lang="ts">
	import {
		getMeetingHeight,
		getTopOffset,
		formatTime
	} from '$lib/helpers/calendarHelpers/calendar-utils';
	import { getShortAddress } from '$lib/helpers/locationHelpers/location-utils';
	import { getLocationColor } from '$lib/helpers/locationHelpers/locationColors';
	import { IconBuilding, IconClock, IconDumbbell, IconGymnastics } from '$lib/icons';
	import IconPerson from '$lib/icons/IconPerson.svelte';
	import { onMount } from 'svelte';

	import type { FullBooking } from '$lib/types/calendarTypes';

	export let booking: FullBooking;
	export let startHour: number;
	export let hourHeight: number;
	export let i: number;

	export let columnIndex: number = 0;
	export let columnCount: number = 1;

	let bookingSlot: HTMLDivElement | null = null;
	let trainerNameElement: HTMLSpanElement | null = null;
	let width = 200; // Default width, will be updated dynamically
	let useInitials = false;
	let debounceTimer: NodeJS.Timeout;

	// Compute fallback end time if none is given
	$: endTime =
		booking.booking.endTime ??
		new Date(new Date(booking.booking.startTime).getTime() + 60 * 60 * 1000).toISOString();

	// Existing layout logic for top, height, and color
	$: topOffset = getTopOffset(booking.booking.startTime, startHour, hourHeight);
	$: meetingHeight = getMeetingHeight(booking.booking.startTime, endTime, hourHeight);
	$: bookingColor = getLocationColor(booking?.location?.id);

	// Determine which icon to show
	$: bookingIcon = (() => {
		const kind = booking.additionalInfo?.bookingContent?.kind?.toLowerCase() ?? '';
		switch (kind) {
			case 'weightlifting':
				return IconDumbbell;
			case 'gymnastics':
				return IconGymnastics;
			default:
				return IconClock;
		}
	})();

	// Compute trainer initials (fallback if full name is too wide)
	$: trainerInitials =
		booking.trainer.firstname && booking.trainer.lastname
			? `${booking.trainer.firstname[0]}${booking.trainer.lastname[0]}`
			: (booking.trainer.firstname ?? 'T');

	// New: compute how wide each column is and the left offset as a %
	$: colWidth = 100 / columnCount;
	$: colLeft = columnIndex * colWidth;

	function checkNameWidth() {
		if (!trainerNameElement || !bookingSlot) return;

		const nameWidth = trainerNameElement.offsetWidth;
		const containerWidth = bookingSlot.offsetWidth;

		// If name is too long compared to the available width, switch to initials
		useInitials = nameWidth > containerWidth * 0.5;
	}

	onMount(() => {
		if (!bookingSlot) return;

		const resizeObserver = new ResizeObserver(() => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				width = bookingSlot.offsetWidth || 200;
				checkNameWidth();
			}, 300);
		});

		resizeObserver.observe(bookingSlot);

		return () => {
			resizeObserver.disconnect();
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});
</script>

<div
	bind:this={bookingSlot}
	class="absolute z-20 flex flex-col gap-[2px] rounded-md border border-dashed bg-white p-1 text-xs shadow-sm"
	style="
		top: {topOffset}px;
		height: {meetingHeight - 4}px;
		left: {colLeft}%;
		width: {colWidth}%;
		color: {bookingColor};
		border-color: {bookingColor};
	"
>
	<div class="flex flex-row gap-1">
		<div class="relative flex h-8 min-h-8 w-8 min-w-8 items-center justify-center rounded-sm">
			<div
				class="absolute inset-0 rounded-sm opacity-20"
				style="background-color: {bookingColor};"
			></div>
			<svelte:component this={bookingIcon} size="20" extraClasses="relative z-10" />
		</div>

		{#if width >= 120}
			<div class="flex flex-col">
				<p>{booking.additionalInfo.bookingContent.kind}</p>
				{#if width >= 125}
					<p>
						{formatTime(booking.booking.startTime)} - {formatTime(endTime)}
					</p>
				{/if}
			</div>
		{/if}
	</div>

	<div class="flex flex-row items-center gap-1">
		<IconPerson size="12" />
		<p class="whitespace-nowrap" bind:this={trainerNameElement}>
			{useInitials ? trainerInitials : `${booking.trainer.firstname} ${booking.trainer.lastname}`}
		</p>
	</div>

	<div class="flex flex-row items-center gap-1">
		<IconBuilding size="12" />
		<p>{getShortAddress(booking.location.name)}</p>
	</div>
</div>
