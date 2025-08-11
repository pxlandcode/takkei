<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip';
	import { formatTime } from '$lib/helpers/calendarHelpers/calendar-utils';

	import { IconCancel, IconClock, IconDumbbell, IconGymnastics } from '$lib/icons';
	import IconMobility from '$icons/IconMobility.svelte';

	import type { FullBooking } from '$lib/types/calendarTypes';
	import { goto } from '$app/navigation';
	import { createEventDispatcher } from 'svelte';

	export let booking: FullBooking;
	export let isClient = false;

	import Checkbox from '../../bits/checkbox/Checkbox.svelte';

	export let selected: boolean = false;
	export let onSelect: (checked: boolean, booking: FullBooking) => void = () => {};
	export let showSelect: boolean = false;

	const dispatch = createEventDispatcher();

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
<button
	on:click={() => {
		dispatch('bookingClick', booking);
	}}
	class="relative flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-all
	{booking.booking.status === 'Cancelled' ? 'cancelled' : ''}
		{booking.booking.status === 'Late_cancelled' ? 'late-cancelled' : ''}"
	style="background-color: {bookingColor}20; border-color: {bookingColor};"
>
	<!-- ✅ Diagonal Lines for Cancelled Bookings -->
	{#if booking.booking.status === 'Cancelled'}
		<div class="cancelled-overlay"></div>
	{/if}
	{#if booking.booking.status === 'Late_cancelled'}
		<div class="late-cancelled-overlay"></div>
	{/if}

	<div class="flex items-center gap-2 text-gray-700">
		<!-- ✅ Select Checkbox -->
		{#if showSelect}
			<div class="relative">
				<Checkbox
					id={`select-${booking.booking.id}`}
					name={`select-${booking.booking.id}`}
					checked={selected}
					on:change={(e) => onSelect(e.detail.checked, booking)}
					label=""
				/>
			</div>
		{/if}

		<span style="color: {bookingColor}">
			<svelte:component this={bookingIcon} size="20px" />
		</span>

		<div class="flex flex-col">
			<div class="flex flex-row">
				<p class="font-base">
					<strong>
						{booking.booking.status === 'Cancelled'
							? 'Avbokad'
							: booking.booking.status === 'Late_cancelled'
								? 'Sen avbokning'
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
	<div class="flex items-center text-sm">
		{#if isClient}
			<a
				href="javascript:void(0);"
				on:click|stopPropagation={() => goto(`/users/${booking.trainer?.id}`)}
				class="font-medium text-orange hover:underline"
				>{`${booking.trainer?.firstname} ${booking.trainer?.lastname}`}</a
			>
		{:else}
			<a
				href="javascript:void(0);"
				on:click|stopPropagation={() => goto(`/clients/${booking.client?.id}`)}
				class="font-medium text-orange hover:underline"
				>{`${booking.client?.firstname} ${booking.client?.lastname}`}</a
			>
		{/if}
	</div>
</button>

<style>
	/* ✅ Base styling */
	.shadow-md {
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	/* ✅ Cancelled Booking Styling (unchanged) */
	.cancelled {
		opacity: 0.5;
		position: relative;
		transition: opacity 0.2s ease-in-out;
	}
	.cancelled:hover {
		opacity: 1;
	}

	/* ✅ Diagonal Stripes Overlay (unchanged) */
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
		pointer-events: none;
		border-radius: 8px;
	}

	/* ✅ Late-cancelled: same structure, different angle/color */
	.late-cancelled {
		opacity: 0.7;
		position: relative;
		transition: opacity 0.2s ease-in-out;
	}
	.late-cancelled:hover {
		opacity: 1;
	}

	.late-cancelled-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-image: repeating-linear-gradient(
			45deg,
			rgba(232, 121, 121, 0.18) 0px,
			/* soft red band */ rgba(232, 121, 121, 0.18) 5px,
			transparent 5px,
			transparent 10px
		);
		pointer-events: none;
		border-radius: 8px;
	}
</style>
