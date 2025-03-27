<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip';
	import { formatTime } from '$lib/helpers/calendarHelpers/calendar-utils';

	import { IconCancel, IconClock, IconDumbbell, IconGymnastics } from '$lib/icons';
	import IconMobility from '$icons/IconMobility.svelte';

	import type { FullBooking } from '$lib/types/calendarTypes';

	export let booking: FullBooking;
	export let isClient = false;

	$: bookingColor = booking.location?.color ? booking.location.color : '#4B5563';

	// ✅ Compute end time
	$: endTime =
		booking.booking.endTime ??
		new Date(new Date(booking.booking.startTime).getTime() + 60 * 60 * 1000).toISOString();

	// ✅ Assign booking icon dynamically
	$: bookingIcon = (() => {
		if (booking.booking.status === 'Cancelled' || booking.booking.status === 'Late_cancelled') {
			return IconCancel;
		}
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

	// ✅ Format date for display
	function formatDate(date: string) {
		return new Date(date).toLocaleDateString('sv-SE', {
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<!-- ✅ Full-width Booking Slot -->
<div
	class="relative flex items-center justify-between rounded-lg border p-3 text-sm transition-all
		{booking.booking.status === 'Cancelled' || booking.booking.status === 'Late_cancelled'
		? 'cancelled'
		: ''}"
	style="background-color: {bookingColor}20; border-color: {bookingColor};"
>
	<!-- ✅ Diagonal Lines for Cancelled Bookings -->
	{#if booking.booking.status === 'Cancelled' || booking.booking.status === 'Late_cancelled'}
		<div class="cancelled-overlay"></div>
	{/if}

	<!-- ✅ Booking Icon & Details -->
	<div class="flex items-center gap-2 text-gray-700">
		<span style="color: {bookingColor}">
			<svelte:component this={bookingIcon} size="20px" />
		</span>

		<div class="flex flex-col">
			<div class="flex flex-row">
				<p class="font-base">
					<strong>
						{booking.booking.status === 'Cancelled' || booking.booking.status === 'Late_cancelled'
							? 'Avbokad'
							: booking.additionalInfo.bookingContent.kind}
					</strong>
				</p>
			</div>
			<p>
				{formatDate(booking.booking.startTime) +
					' ' +
					formatTime(booking.booking.startTime) +
					' - ' +
					formatTime(endTime)}
			</p>
		</div>
	</div>

	<!-- ✅ Trainer Info -->
	<div class="flex items-center text-sm text-gray-700">
		{#if isClient}
			<p>{`${booking.trainer?.firstname} ${booking.trainer?.lastname}`}</p>
		{:else}
			<p>{`${booking.client?.firstname} ${booking.client?.lastname}`}</p>
		{/if}
	</div>
</div>

<style>
	/* ✅ Base styling */
	.shadow-md {
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	/* ✅ Cancelled Booking Styling */
	.cancelled {
		opacity: 0.5;
		position: relative;
		transition: opacity 0.2s ease-in-out;
	}

	.cancelled:hover {
		opacity: 1;
	}

	/* ✅ Diagonal Stripes Overlay */
	.cancelled-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-image: repeating-linear-gradient(
			-45deg,
			rgba(0, 0, 0, 0.1) 0px,
			rgba(0, 0, 0, 0.1) 5px,
			transparent 5px,
			transparent 10px
		);
		pointer-events: none; /* ✅ Prevent interaction */
		border-radius: 8px;
	}
</style>
