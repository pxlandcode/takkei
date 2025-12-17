<script lang="ts">
	import { formatTime } from '$lib/helpers/calendarHelpers/calendar-utils';

	import { IconCancel, IconTraining, IconShiningStar, IconGraduationCap, IconPlane } from '$lib/icons';
	import IconWrench from '$icons/IconWrench.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';

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

	let showTraineeAsClient = false;
	let participant: { id?: number | null; firstname?: string | null; lastname?: string | null } | null =
		null;

	$: bookingColor = booking.location?.color ? booking.location.color : '#4B5563';
	$: isPersonalBooking = booking.isPersonalBooking;
	$: showTraineeAsClient =
		!isPersonalBooking && (booking.booking.internalEducation || booking.additionalInfo?.education);
	$: participant = showTraineeAsClient ? booking.trainee : booking.client;

	// ✅ Compute end time
	$: endTime =
		booking.booking.endTime ??
		new Date(new Date(booking.booking.startTime).getTime() + 60 * 60 * 1000).toISOString();

	// ✅ Assign booking icon dynamically
	$: bookingIcon = (() => {
		if (
			!isPersonalBooking &&
			(booking.booking.status === 'Cancelled' || booking.booking.status === 'Late_cancelled')
		) {
			return IconCancel;
		}
		if (booking.booking.tryOut) return IconShiningStar;
		if (booking.booking.internalEducation) return IconWrench;
		if (booking.additionalInfo?.education) return IconGraduationCap;
		if (booking.additionalInfo?.internal) return IconPlane;
		return IconTraining;
	})();

	$: bookingHeadline = (() => {
		if (isPersonalBooking) {
			const name = booking.personalBooking?.name?.trim();
			if (name) return name;
			return 'Personlig bokning';
		}
		if (booking.booking.status === 'Cancelled') {
			return 'Avbokad';
		}
		if (booking.booking.status === 'Late_cancelled') {
			return 'Sen avbokning';
		}
		return booking.additionalInfo?.bookingContent?.kind ?? 'Bokning';
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
	class="relative flex w-full items-center justify-between rounded-sm border p-3 text-left text-sm transition-all
	{booking.booking.status === 'Cancelled' ? 'cancelled' : ''}
		{booking.booking.status === 'Late_cancelled' ? 'late-cancelled' : ''}"
	style="background-color: {bookingColor}20; border-color: {bookingColor};"
>
	{#if (booking.linkedNoteCount ?? 0) > 0}
		<div class="absolute right-2 top-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
			<Icon icon="Notes" size="12px" />
			<span>{booking.linkedNoteCount}</span>
		</div>
	{/if}
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
					<strong>{bookingHeadline}</strong>
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
		{#if isPersonalBooking}
			<span class="font-medium text-gray-700">Visa detaljer</span>
		{:else if isClient}
			{#if booking.trainer?.id}
				<a
					href="javascript:void(0);"
					on:click|stopPropagation={() => goto(`/users/${booking.trainer?.id}`)}
					class="font-medium text-orange hover:underline"
					>{`${booking.trainer?.firstname ?? ''} ${booking.trainer?.lastname ?? ''}`.trim() || 'Okänd tränare'}</a
				>
			{:else}
				<span class="font-medium text-gray-600">Okänd tränare</span>
			{/if}
		{:else}
			{#if showTraineeAsClient}
				{#if participant?.id}
					<a
						href="javascript:void(0);"
						on:click|stopPropagation={() => goto(`/users/${participant?.id}`)}
						class="font-medium text-orange hover:underline"
					>
						{`${participant?.firstname ?? ''} ${participant?.lastname ?? ''}`.trim() ||
							'Trainee saknas'}
					</a>
				{:else}
					<span class="font-medium text-gray-600">Trainee saknas</span>
				{/if}
			{:else}
				{#if participant?.id}
					<a
						href="javascript:void(0);"
						on:click|stopPropagation={() => goto(`/clients/${participant?.id}`)}
						class="font-medium text-orange hover:underline"
					>
						{`${participant?.firstname ?? ''} ${participant?.lastname ?? ''}`.trim() ||
							'Okänd klient'}
					</a>
				{:else}
					<span class="font-medium text-gray-600">Okänd klient</span>
				{/if}
			{/if}
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
