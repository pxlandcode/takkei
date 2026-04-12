<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { formatTime } from '$lib/helpers/calendarHelpers/calendar-utils';
	import Icon from '../../../bits/icon-component/Icon.svelte';

	type PackageBooking = {
		id: number;
		date: string;
		datetime?: string | null;
		is_saldojustering: boolean;
		trainer_name?: string | null;
		client_name?: string | null;
	};

	export let booking: PackageBooking;
	export let showClientColumn = false;
	export let showActions = false;

	const dispatch = createEventDispatcher<{ bookingClick: PackageBooking }>();
	const today = new Date().toISOString().slice(0, 10);

	$: isPastBooking = !booking.is_saldojustering && booking.date < today;
	$: bookingColor = booking.is_saldojustering ? '#ef4444' : isPastBooking ? '#94a3b8' : '#22c55e';
	$: bookingIcon = booking.is_saldojustering ? 'AlertTriangle' : 'Calendar';
	$: bookingHeadline = booking.is_saldojustering ? 'Saldojustering' : 'Träning';
	$: endTime =
		booking.datetime != null
			? new Date(
					new Date(booking.datetime.replace(' ', 'T')).getTime() + 60 * 60 * 1000
				).toISOString()
			: null;

	function formatDate(date: string) {
		return new Date(date).toLocaleDateString('sv-SE', {
			month: 'short',
			day: 'numeric'
		});
	}

	function handleClick() {
		dispatch('bookingClick', booking);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.target !== event.currentTarget) return;
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		handleClick();
	}
</script>

<div
	role="button"
	tabindex="0"
	on:click={handleClick}
	on:keydown={handleKeydown}
	class="package-booking-slot relative flex w-full items-center justify-between rounded-sm border p-3 text-left text-sm transition-all
	{isPastBooking ? 'past' : ''}
	{booking.is_saldojustering ? 'saldo' : ''}"
	style="background-color: {bookingColor}20; border-color: {bookingColor};"
>
	{#if booking.is_saldojustering}
		<div class="saldo-overlay"></div>
	{:else if isPastBooking}
		<div class="past-overlay"></div>
	{/if}

	<div class="slot-main flex min-w-0 items-center gap-2 text-gray-700">
		<span style="color: {bookingColor}">
			<Icon icon={bookingIcon} size="20px" />
		</span>

		<div class="flex min-w-0 flex-col">
			<div class="flex flex-row">
				<p class="font-base truncate">
					<strong>{bookingHeadline}</strong>
				</p>
			</div>
			<p class="text-gray-700">
				{formatDate(booking.date)}
				{#if !booking.is_saldojustering && booking.datetime && endTime}
					{` ${formatTime(booking.datetime.replace(' ', 'T'))} - ${formatTime(endTime)}`}
				{/if}
			</p>
		</div>
	</div>

	<div class="slot-side ml-3 flex items-center gap-2 text-sm">
		<div class="flex min-w-0 flex-col items-end text-right">
			{#if !booking.is_saldojustering}
				<span class="font-medium text-gray-700">{booking.trainer_name || 'Okänd tränare'}</span>
			{/if}
			{#if showClientColumn}
				<span class="text-xs text-gray-500">{booking.client_name || 'Okänd klient'}</span>
			{/if}
		</div>

		{#if showActions && $$slots.actions}
			<div class="actions-slot" on:click|stopPropagation on:keydown|stopPropagation>
				<slot name="actions" />
			</div>
		{/if}
	</div>
</div>

<style>
	.past,
	.saldo {
		position: relative;
		transition:
			box-shadow 0.2s ease,
			opacity 0.2s ease-in-out;
	}

	.past {
		opacity: 0.72;
	}

	.saldo {
		opacity: 0.9;
	}

	.past:hover,
	.saldo:hover {
		opacity: 1;
	}

	.package-booking-slot {
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
		cursor: pointer;
	}

	.package-booking-slot:hover {
		box-shadow: 0 4px 10px rgba(15, 23, 42, 0.1);
	}

	.package-booking-slot:focus-visible {
		outline: 2px solid #94a3b8;
		outline-offset: 2px;
	}

	.past-overlay,
	.saldo-overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		border-radius: 8px;
	}

	.past-overlay {
		background-image: repeating-linear-gradient(
			-45deg,
			rgba(0, 0, 0, 0.1) 0px,
			rgba(0, 0, 0, 0.1) 5px,
			transparent 5px,
			transparent 10px
		);
	}

	.saldo-overlay {
		background-image: repeating-linear-gradient(
			45deg,
			rgba(239, 68, 68, 0.18) 0px,
			rgba(239, 68, 68, 0.18) 5px,
			transparent 5px,
			transparent 10px
		);
	}

	.actions-slot {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
	}

	@media (max-width: 767px) {
		.package-booking-slot {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.5rem;
		}

		.slot-side {
			margin-left: 0;
			width: 100%;
			justify-content: space-between;
		}

		.slot-main {
			width: 100%;
		}
	}
</style>
