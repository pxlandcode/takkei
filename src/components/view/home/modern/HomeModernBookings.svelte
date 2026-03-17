<script lang="ts">
	import { onMount } from 'svelte';
	import type { ComponentType } from 'svelte';
	import Button from '../../../bits/button/Button.svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import ProfileBookingSlot from '../../../ui/profileBookingSlot/ProfileBookingSlot.svelte';
	import BookingDetailsPopup from '../../../ui/bookingDetailsPopup/BookingDetailsPopup.svelte';
	import { fetchBookings } from '$lib/services/api/calendarService';
	import { openPopup } from '$lib/stores/popupStore';
	import { user } from '$lib/stores/userStore';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import { addDays, dayParam, formatLongDate } from './homeModernUtils';

	let mounted = false;
	let bookings: FullBooking[] = [];
	let bookingsLoading = true;
	let selectedDate = new Date();
	let showCancelled = false;
	let bookingsUserId: number | null = null;

	const cancelledStatuses = new Set(['Cancelled', 'Late_cancelled', 'CancelledLate']);

	$: cancelledBookings = bookings.filter((booking) =>
		cancelledStatuses.has(booking.booking.status ?? '')
	);
	$: activeBookings = bookings.filter(
		(booking) => !cancelledStatuses.has(booking.booking.status ?? '')
	);
	$: cancelledCount = cancelledBookings.length;
	$: lateCancelledCount = bookings.filter(
		(booking) => booking.booking.status === 'Late_cancelled'
	).length;
	$: visibleBookings = showCancelled ? cancelledBookings : activeBookings;

	onMount(() => {
		mounted = true;

		if ($user?.id) {
			bookingsUserId = $user.id;
			void loadBookings();
		} else {
			bookingsLoading = false;
		}
	});

	$: if (mounted && $user?.id && $user.id !== bookingsUserId) {
		bookingsUserId = $user.id;
		showCancelled = false;
		void loadBookings();
	}

	$: if (mounted && !$user?.id && bookingsUserId !== null) {
		bookingsUserId = null;
		bookings = [];
		bookingsLoading = false;
	}

	function onPreviousDay() {
		selectedDate = addDays(selectedDate, -1);
		showCancelled = false;
		void loadBookings();
	}

	function onNextDay() {
		selectedDate = addDays(selectedDate, 1);
		showCancelled = false;
		void loadBookings();
	}

	function onToday() {
		selectedDate = new Date();
		showCancelled = false;
		void loadBookings();
	}

	function cancelledToggleText() {
		if (!cancelledCount) return 'Avbokningar';
		if (!lateCancelledCount) return `${cancelledCount} avbokade`;
		return `${cancelledCount} avbokade (${lateCancelledCount} ${
			lateCancelledCount === 1 ? 'debiterbar' : 'debiterbara'
		})`;
	}

	async function loadBookings() {
		if (!$user?.id) return;

		bookingsLoading = true;
		try {
			const filters = {
				from: dayParam(selectedDate),
				to: dayParam(addDays(selectedDate, 1)),
				trainerIds: [$user.id],
				sortAsc: true,
				personalBookings: true
			};

			bookings = await fetchBookings(filters, fetch, undefined, 0, true);
		} catch (error) {
			console.error('Failed to load bookings', error);
		} finally {
			bookingsLoading = false;
		}
	}

	function openBookingDetails(booking: FullBooking) {
		openPopup({
			header: 'Bokningsdetaljer',
			icon: 'Calendar',
			component: BookingDetailsPopup as unknown as ComponentType,
			maxWidth: '650px',
			props: { booking }
		});
	}
</script>

<section class="bg-white p-5 shadow-sm">
	<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
		<h2 class="flex items-center gap-2 text-lg font-semibold text-gray-900">
			<Icon icon="Calendar" size="18px" color="primary" />
			Bokningar
		</h2>
		<div class="flex items-center gap-1">
			<Button
				icon="ChevronLeft"
				variant="secondary"
				iconSize="14px"
				small
				on:click={onPreviousDay}
			/>
			<Button text="Idag" variant="secondary" small on:click={onToday} />
			<Button icon="ChevronRight" variant="secondary" iconSize="14px" small on:click={onNextDay} />
		</div>
	</div>
	<div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<p class="text-sm font-medium text-gray-500">
			{formatLongDate(selectedDate)}{#if showCancelled}
				<span class="text-red ml-2">(visar avbokade)</span>
			{/if}
		</p>
		{#if cancelledCount > 0}
			<Button
				text={cancelledToggleText()}
				iconLeft="Cancel"
				iconLeftSize="12px"
				variant={showCancelled ? 'cancel' : 'danger-outline'}
				small
				on:click={() => (showCancelled = !showCancelled)}
			/>
		{/if}
	</div>
	{#if bookingsLoading}
		<div class="flex h-32 items-center justify-center">
			<div
				class="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
			></div>
		</div>
	{:else if visibleBookings.length === 0}
		<div class="flex h-32 flex-col items-center justify-center text-gray-400">
			<Icon icon={showCancelled ? 'Cancel' : 'Calendar'} size="32px" />
			<p class="mt-2 text-sm">
				{showCancelled ? 'Inga avbokningar denna dag' : 'Inga bokningar denna dag'}
			</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each visibleBookings as booking (booking.booking.id)}
				<div
					class="w-full cursor-pointer"
					role="button"
					tabindex="0"
					on:click={() => openBookingDetails(booking)}
					on:keydown={(keyboardEvent) =>
						keyboardEvent.key === 'Enter' && openBookingDetails(booking)}
				>
					<ProfileBookingSlot {booking} />
				</div>
			{/each}
		</div>
	{/if}
</section>
