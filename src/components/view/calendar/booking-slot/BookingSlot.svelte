<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import {
		getMeetingHeight,
		getTopOffset,
		formatTime
	} from '$lib/helpers/calendarHelpers/calendar-utils';
	import { getShortAddress } from '$lib/helpers/locationHelpers/location-utils';
	import { getLocationColor } from '$lib/helpers/locationHelpers/locationColors';
	import { IconClock, IconDumbbell, IconGymnastics } from '$lib/icons';

	import type { FullBooking } from '$lib/types/calendarTypes';
	import { user } from '$lib/stores/userStore';
	import IconMobility from '$icons/IconMobility.svelte';

	export let booking: FullBooking;
	export let startHour: number;
	export let hourHeight: number;
	export let i: number;
	export let toolTipText: string | undefined;

	export let columnIndex = 0;
	export let columnCount = 1;

	let bookingSlot: HTMLDivElement | null = null;
	let trainerNameElement: HTMLSpanElement | null = null;
	let width = 200;
	let useInitials = false;
	let debounceTimer: NodeJS.Timeout;

	$: endTime =
		booking.booking.endTime ??
		new Date(new Date(booking.booking.startTime).getTime() + 60 * 60 * 1000).toISOString();

	$: topOffset = getTopOffset(booking.booking.startTime, startHour, hourHeight);
	$: meetingHeight = getMeetingHeight(booking.booking.startTime, endTime, hourHeight);
	$: bookingColor = getLocationColor(booking?.location?.id);

	$: bookingIcon = (() => {
		const kind = booking.additionalInfo?.bookingContent?.kind?.toLowerCase() ?? '';
		switch (kind) {
			case 'weightlifting':
				return IconDumbbell;
			case 'gymnastics':
				return IconGymnastics;
			case 'mobility':
				return IconMobility;
			default:
				return IconClock;
		}
	})();

	$: trainerInitials =
		booking.trainer?.firstname && booking.trainer?.lastname
			? `${booking.trainer.firstname[0]}${booking.trainer.lastname[0]}`
			: booking.isPersonalBooking
				? 'P'
				: 'T';

	$: colWidth = 100 / columnCount;
	$: colLeft = columnIndex * colWidth;

	let fullNameWidth = 0; // Store full name width

	function measureFullNameWidth() {
		setTimeout(() => {
			if (!trainerNameElement) return; // Ensure element exists

			useInitials = false; // Ensure full name is measured
			fullNameWidth = trainerNameElement.offsetWidth;

			checkNameWidth();
		}, 10); // Small delay to allow rendering
	}

	function checkNameWidth() {
		if (fullNameWidth === 0) return;

		const containerWidth = bookingSlot.offsetWidth;

		// Use initials if full name is too wide
		useInitials = fullNameWidth > containerWidth - 8;
	}

	onMount(async () => {
		await tick(); // Ensure DOM elements are rendered

		setTimeout(() => {
			measureFullNameWidth(); // Measure full name after ensuring it exists
		}, 10);

		const resizeObserver = new ResizeObserver(() => {
			if (debounceTimer) clearTimeout(debounceTimer);

			debounceTimer = setTimeout(() => {
				width = bookingSlot.offsetWidth || 200;
				checkNameWidth();
			}, 100);
		});

		if (bookingSlot) {
			resizeObserver.observe(bookingSlot);
		}

		return () => {
			resizeObserver.disconnect();
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});
</script>

<div
	bind:this={bookingSlot}
	class="absolute z-20 flex flex-col gap-[2px] rounded-md p-1 text-xs text-gray shadow-sm {useInitials
		? 'items-center'
		: 'items-start'}
        {booking.trainer?.id === $user.id ? 'border ' : ''}"
	style="
		top: {topOffset}px;
		height: {meetingHeight - 4}px;
		left: calc({colLeft}% + 2px);
		width: calc({colWidth}% - 4px);
	
        background-color: {bookingColor}20;
        border-color: {bookingColor};
	"
	use:tooltip={{ content: toolTipText }}
>
	{#if !booking.isPersonalBooking}
		<div class="flex flex-row">
			<div
				class="relative flex items-center justify-center gap-2 rounded-sm px-1"
				style="color: {bookingColor}"
			>
				<svelte:component this={bookingIcon} size="20px" extraClasses="relative z-10" />

				{#if width >= 120}
					<div class="flex flex-col text-xs text-gray">
						<p>{booking.additionalInfo.bookingContent.kind}</p>

						{#if width >= 125}
							<p class="text-xxs">
								{formatTime(booking.booking.startTime)} - {formatTime(endTime)}
							</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="flex flex-row items-center text-xs">
			<p class="whitespace-nowrap" bind:this={trainerNameElement}>
				{useInitials ? trainerInitials : `${booking.trainer.firstname} ${booking.trainer.lastname}`}
			</p>
		</div>

		<div class="flex flex-row items-center text-xs">
			<p>{booking.location.name ? getShortAddress(booking.location.name) : ''}</p>
		</div>
	{:else}
		<div class="flex flex-row items-center text-xs">
			<p>{booking.personalBooking.name}</p>
		</div>
	{/if}
</div>
