<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { user } from '$lib/stores/userStore';
	import Icon from '../../icon-component/Icon.svelte';
	import Button from '../../button/Button.svelte';
	import { fetchBookings } from '$lib/services/api/calendarService';
	import ProfileBookingSlot from '../../../ui/profileBookingSlot/ProfileBookingSlot.svelte';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import { openPopup } from '$lib/stores/popupStore';
	import BookingDetailsPopup from '../../../ui/bookingDetailsPopup/BookingDetailsPopup.svelte';

	let bookings: FullBooking[] = [];
	let isLoading = true;
	let selectedDate = new Date();
	let showCancelled = false;

	const cancelledStatuses = new Set(['Cancelled', 'Late_cancelled', 'CancelledLate']);

	function isCancelledStatus(status?: string | null): boolean {
		if (!status) return false;
		return cancelledStatuses.has(status);
	}

	$: cancelledBookings = bookings.filter((b) => isCancelledStatus(b.booking.status));
	$: activeBookings = bookings.filter((b) => !isCancelledStatus(b.booking.status));
	$: cancelledCount = cancelledBookings.length;
	$: lateCancelledCount = bookings.filter((b) => b.booking.status === 'Late_cancelled').length;
	$: visibleBookings = showCancelled ? cancelledBookings : activeBookings;

	$: $user;
	$: if (browser && $user && selectedDate) loadBookings();

	const TZ = 'Europe/Stockholm';

	function ymdStockholm(d: Date): string {
		const parts = new Intl.DateTimeFormat('sv-SE', {
			timeZone: TZ,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		})
			.formatToParts(d)
			.reduce((a, p) => ((a[p.type] = p.value), a), {} as Record<string, string>);
		return `${parts.year}-${parts.month}-${parts.day}`;
	}
	function dayParam(d: Date) {
		return `${ymdStockholm(d)} 12:00:00`;
	}
	function addDays(d: Date, n: number) {
		const x = new Date(d);
		x.setDate(x.getDate() + n);
		return x;
	}

	function formatDateLabel(date: Date): string {
		return date.toLocaleDateString('sv-SE', {
			timeZone: TZ,
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	}

	async function loadBookings() {
		if (!browser) return;
		if (!$user?.id || !selectedDate) return;

		isLoading = true;
		try {
			// CHANGED: build params using noon-in-Stockholm
			const from = dayParam(selectedDate);
			const to = dayParam(addDays(selectedDate, 1));

			const filters = {
				from,
				to,
				trainerIds: [$user.id],
				sortAsc: true,
				personalBookings: true
			};

			// Pass fetchAllStatuses=true to include cancelled bookings
			bookings = await fetchBookings(filters, fetch, undefined, 0, true);
		} catch (error) {
			console.error('Error loading bookings:', error);
		} finally {
			isLoading = false;
		}
	}

	function openBookingDetails(booking: FullBooking) {
		openPopup({
			header: 'Bokningsdetaljer',
			icon: 'CircleInfo',
			component: BookingDetailsPopup,
			props: { booking },
			maxWidth: '650px',
			height: '850px',
			listeners: {
				updated: () => {
					loadBookings();
				}
			}
		});
	}

	// Navigation
	function onPrevious() {
		selectedDate = addDays(selectedDate, -1);
		showCancelled = false;
	}
	function onNext() {
		selectedDate = addDays(selectedDate, 1);
		showCancelled = false;
	}
	function onToday() {
		selectedDate = new Date();
		showCancelled = false;
	}
</script>

<div class="module-container rounded-sm border border-gray-200 bg-white p-4 shadow-md">
	<!-- Header -->
	<div class="mb-3 flex items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<div class="bg-text flex h-6 w-6 items-center justify-center rounded-full text-white">
				<Icon icon="Clock" size="14px" />
			</div>
			<h3 class="text-text text-lg font-semibold">Bokningar</h3>
		</div>

		<!-- Navigation Buttons -->
		<div class="flex items-center gap-1">
			<Button icon="ChevronLeft" variant="secondary" iconSize="16px" on:click={onPrevious} />
			<Button text="Idag" variant="secondary" on:click={onToday} />
			<Button icon="ChevronRight" variant="secondary" iconSize="16px" on:click={onNext} />
		</div>
	</div>

	<!-- Content -->
	<p class="mb-2 text-sm font-medium text-gray-500">
		{formatDateLabel(selectedDate)}{#if showCancelled}
			<span class="text-red ml-2">(visar avbokade)</span>{/if}
	</p>
	{#if isLoading}
		<p class="text-sm text-gray-500">Laddar bokningar...</p>
	{:else if visibleBookings.length === 0}
		<p class="text-sm text-gray-400 italic">
			{showCancelled ? 'Inga avbokningar denna dag' : 'Inga bokningar denna dag 🧘'}
		</p>
	{:else}
		<div class="custom-scrollbar scroll-area flex-1 space-y-2 overflow-y-auto pr-1">
			{#each visibleBookings as booking}
				<ProfileBookingSlot
					{booking}
					isClient={false}
					on:bookingClick={(event) => openBookingDetails(event.detail)}
				/>
			{/each}
		</div>
	{/if}

	<!-- Cancelled toggle in bottom right -->
	{#if cancelledCount > 0}
		<button
			type="button"
			class="cancelled-toggle"
			class:active={showCancelled}
			on:click={() => (showCancelled = !showCancelled)}
			title={showCancelled ? 'Visa aktiva bokningar' : 'Visa avbokningar'}
		>
			<Icon icon="Cancel" size="12px" />
			<span>{cancelledCount} avbokade</span>
			{#if lateCancelledCount > 0}
				<span class="late-badge"
					>({lateCancelledCount} {lateCancelledCount === 1 ? 'debiterbar' : 'debiterbara'})</span
				>
			{/if}
		</button>
	{/if}
</div>

<style>
	.module-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.scroll-area {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}

	.cancelled-toggle {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.35rem 0.6rem;
		border-radius: 0.25rem;
		background: #f4f6ff;
		color: #c04c3d;
		font-size: 0.7rem;
		font-weight: 500;
		border: 1px solid #e87979;
		cursor: pointer;
		transition: all 0.15s ease;
		align-self: flex-end;
		margin-top: 0.75rem;
		flex-shrink: 0;
	}

	.cancelled-toggle:hover {
		background: #fce8e8;
		border-color: #c04c3d;
	}

	.cancelled-toggle.active {
		background: #c04c3d;
		color: white;
		border-color: #c04c3d;
	}

	.late-badge {
		opacity: 0.8;
	}
</style>
