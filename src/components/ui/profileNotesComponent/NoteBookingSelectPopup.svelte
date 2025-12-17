<script lang="ts">
	import { onMount } from 'svelte';
	import { writable, get } from 'svelte/store';
	import { fetchBookings } from '$lib/services/api/calendarService';
	import ProfileBookingSlot from '../profileBookingSlot/ProfileBookingSlot.svelte';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import { debounce } from '$lib/utils/debounce';
	import { createEventDispatcher } from 'svelte';
	import { closePopup } from '$lib/stores/popupStore';

export let clientId: number | null = null;
export let onSelect: (payload: { bookingId: number; bookingLabel?: string; booking?: any }) => void =
	() => {};

const dispatch = createEventDispatcher();

	let bookings = writable([]);
	let page = writable(0);
	let isLoading = writable(false);
	let hasMore = writable(true);
	let selectedDate = writable('');
	let selectedCancelledOption = writable({ value: false, label: 'Visa inte avbokade' });

	const LIMIT = 20;

	const debouncedLoad = debounce((val) => {
		if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
			void loadBookings(true);
		}
	}, 300);

	function ymdNoon(d: Date): string {
		const x = new Date(d);
		x.setHours(12, 0, 0, 0);
		return x.toISOString().slice(0, 10);
	}

	function dayParam(ymd: string) {
		return `${ymd} 12:00:00`;
	}

	onMount(() => {
		const today = new Date();
		const oneMonthBack = new Date(today);
		oneMonthBack.setMonth(today.getMonth() - 1);
		selectedDate.set(ymdNoon(oneMonthBack));
		void loadBookings(true);
	});

	async function loadBookings(reset = false) {
		if (!clientId) return;
		if (get(isLoading) || (!get(hasMore) && !reset)) return;

		const rawDate = get(selectedDate);
		if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return;

		const fetchCancelled = get(selectedCancelledOption).value;

		if (reset) {
			bookings.set([]);
			page.set(0);
			hasMore.set(true);
		}

		const filters: any = {
			from: dayParam(rawDate),
			forwardOnly: true,
			sortAsc: true,
			clientIds: [clientId]
		};

		isLoading.set(true);
		try {
			const newBookings = await fetchBookings(
				filters,
				fetch,
				LIMIT,
				get(page) * LIMIT,
				fetchCancelled
			);

			if (newBookings.length < LIMIT) hasMore.set(false);
			bookings.update((prev) => [...prev, ...newBookings]);
			page.update((p) => p + 1);
		} catch (error) {
			console.error('Error fetching bookings for note linking:', error);
		} finally {
			isLoading.set(false);
		}
	}

	function handleScroll(event) {
		const bottom =
			event.target.scrollHeight - event.target.scrollTop <= event.target.clientHeight + 50;
		if (bottom && get(hasMore) && !get(isLoading)) {
			void loadBookings();
		}
	}

	function updateStartDate(event) {
		const val = event.target.value;
		selectedDate.set(val);
		debouncedLoad(val);
	}

	function handleCancelledSelection(event: CustomEvent<boolean>) {
		selectedCancelledOption.set(
			event.detail
				? { value: true, label: 'Visa avbokade' }
				: { value: false, label: 'Visa inte avbokade' }
		);
		void loadBookings(true);
	}

	function bookingLabel(booking: any) {
		const start = booking.booking?.startTime ? new Date(booking.booking.startTime) : null;
		const timeLabel = start
			? `${start.toLocaleDateString('sv-SE')} ${start.toLocaleTimeString('sv-SE', {
					hour: '2-digit',
					minute: '2-digit'
				})}`
			: 'Okänd tid';
		const trainer = booking.trainer?.firstname
			? `${booking.trainer.firstname} ${booking.trainer.lastname}`
			: '';
		const kind = booking.additionalInfo?.bookingContent?.kind ?? '';
		return [timeLabel, kind, trainer].filter(Boolean).join(' · ');
	}

	function handleBookingClick(event) {
		const booking = event.detail;
		onSelect({
			bookingId: booking.booking.id,
			bookingLabel: bookingLabel(booking),
			booking
		});
		dispatch('select', {
			bookingId: booking.booking.id,
			bookingLabel: bookingLabel(booking)
		});
		closePopup();
	}
</script>

{#if !clientId}
	<p class="text-sm text-gray-600">Ingen kund vald.</p>
{:else}
	<div class="flex flex-col gap-4">
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<label class="text-gray text-sm font-medium">Från datum</label>
				<input
					type="date"
					value={$selectedDate}
					on:change={updateStartDate}
					class="text-gray h-9 w-full rounded-sm border p-2"
				/>
			</div>

			<div class="mt-6">
				<OptionButton
					options={[
						{ value: false, label: 'Visa inte avbokade' },
						{ value: true, label: 'Visa avbokade' }
					]}
					bind:selectedOption={$selectedCancelledOption}
					size="small"
					on:select={handleCancelledSelection}
					full
				/>
			</div>
		</div>

		<div class="custom-scrollbar h-full max-h-[65vh] space-y-3 overflow-y-scroll pt-1" on:scroll={handleScroll}>
			{#each $bookings as booking (booking.booking.id)}
				<ProfileBookingSlot booking={booking} isClient={true} showSelect={false} on:bookingClick={handleBookingClick} />
			{/each}

			{#if $isLoading}
				<p class="text-gray-bright mt-4 text-center">Laddar bokningar...</p>
			{/if}

			{#if !$hasMore && $bookings.length === 0 && !$isLoading}
				<p class="text-gray-bright mt-4 text-center">Inga bokningar hittades.</p>
			{/if}

			{#if !$hasMore && $bookings.length > 0}
				<p class="text-gray-bright mt-4 text-center">Inga fler bokningar att visa.</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: #cbd5e1 transparent;
	}
</style>
