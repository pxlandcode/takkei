<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchBookings } from '$lib/services/api/calendarService';
	import { writable, get } from 'svelte/store';

	import ProfileBookingSlot from '../profileBookingSlot/ProfileBookingSlot.svelte';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';

	export let trainerId: number;

	// ✅ Reactive Stores
	let bookings = writable([]);
	let page = writable(0);
	let isLoading = writable(false);
	let hasMore = writable(true);

	// ✅ Filters
	let selectedDate = writable(new Date().toISOString().split('T')[0]); // Default to today
	let selectedCancelledOption = writable({ value: false, label: 'Visa inte avbokade' });

	const LIMIT = 20;

	// ✅ Fetch initial bookings when mounted
	onMount(() => {
		loadMoreBookings(true);
	});

	// ✅ Log bookings in console for debugging
	$: console.log('Bookings:', get(bookings));

	// ✅ Fetch more bookings when scrolling
	async function loadMoreBookings(reset = false) {
		if (get(isLoading) || (!get(hasMore) && !reset)) return;
		isLoading.set(true);

		if (reset) {
			bookings.set([]);
			page.set(0);
			hasMore.set(true);
		}

		const from = '1970-01-01';
		const to = new Date($selectedDate).toISOString().split('T')[0];

		const filters = {
			trainerIds: [trainerId],
			from, // ✅ Fetching older bookings
			to // ✅ The latest selected date
		};
		const fetchCancelled = get(selectedCancelledOption).value;

		console.log('Fetching with filters:', filters);
		try {
			console.log('Fetching with filters:', filters);
			const newBookings = await fetchBookings(
				filters,
				fetch,
				LIMIT,
				get(page) * LIMIT,
				fetchCancelled
			);
			console.log('New bookings:', newBookings);

			if (newBookings.length < LIMIT) hasMore.set(false); // Stop pagination if fewer results
			bookings.update((prev) => [...prev, ...newBookings]); // Append new bookings
			page.update((p) => p + 1);
		} catch (error) {
			console.error('Error fetching bookings:', error);
		} finally {
			isLoading.set(false);
		}
	}

	// ✅ Handle Infinite Scroll
	function handleScroll(event) {
		const bottom =
			event.target.scrollHeight - event.target.scrollTop <= event.target.clientHeight + 50;
		if (bottom && get(hasMore) && !get(isLoading)) {
			loadMoreBookings();
		}
	}

	// ✅ Update selected date & re-fetch
	function updateStartDate(event) {
		selectedDate.set(event.target.value);
		loadMoreBookings(true);
	}

	// ✅ Toggle Canceled Bookings
	function handleCancelledSelection(event: CustomEvent<boolean>) {
		selectedCancelledOption.set(
			event.detail
				? { value: true, label: 'Visa avbokade' }
				: { value: false, label: 'Visa inte avbokade' }
		);
		loadMoreBookings(true);
	}
</script>

<!-- 🔹 Filters -->
<div class="wrapper">
	<div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
		<!-- ✅ Start Date Filter -->
		<div>
			<label class="text-sm font-medium text-gray">Från datum</label>
			<input
				type="date"
				value={$selectedDate}
				on:change={updateStartDate}
				class="h-9 w-full rounded-lg border p-2 text-gray"
			/>
		</div>

		<!-- ✅ Toggle Canceled Bookings -->
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

	<!-- 🔹 Booking List (Infinite Scroll) -->
	<div
		class="h-full max-h-[65vh] space-y-3 overflow-y-scroll custom-scrollbar"
		on:scroll={handleScroll}
	>
		{#each $bookings as booking}
			<ProfileBookingSlot {booking} />
		{/each}

		{#if $isLoading}
			<p class="mt-4 text-center text-gray-bright">Laddar fler bokningar...</p>
		{/if}

		{#if !$hasMore && $bookings.length > 0}
			<p class="mt-4 text-center text-gray-bright">Inga fler bokningar att visa.</p>
		{/if}
	</div>
</div>

<style>
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: #cbd5e1 transparent;
	}
</style>
