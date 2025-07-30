<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';
	import Icon from '../../icon-component/Icon.svelte';
	import Button from '../../button/Button.svelte';
	import { fetchBookings } from '$lib/services/api/calendarService';
	import ProfileBookingSlot from '../../../ui/profileBookingSlot/ProfileBookingSlot.svelte';

	let bookings: any[] = [];
	let isLoading = true;

	let selectedDate = new Date(); // ⏱ controlled date

	$: $user;
	$: if ($user && selectedDate) loadBookings();

	function formatDateLabel(date: Date): string {
		return date.toLocaleDateString('sv-SE', {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	}

	async function loadBookings() {
		if (!$user?.id || !selectedDate) return;

		isLoading = true;
		try {
			const dateStr = selectedDate.toISOString().split('T')[0];
			const todayStr = new Date(selectedDate);
			todayStr.setDate(todayStr.getDate() + 1);
			const filters = {
				from: dateStr,
				to: todayStr.toISOString().split('T')[0],
				trainerIds: [$user.id],
				sortAsc: true
			};

			bookings = await fetchBookings(filters, fetch);
		} catch (error) {
			console.error('Error loading bookings:', error);
		} finally {
			isLoading = false;
		}
	}

	// Navigation handlers
	function onPrevious() {
		selectedDate = new Date(selectedDate);
		selectedDate.setDate(selectedDate.getDate() - 1);
	}

	function onNext() {
		selectedDate = new Date(selectedDate);
		selectedDate.setDate(selectedDate.getDate() + 1);
	}

	function onToday() {
		selectedDate = new Date();
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-md">
	<!-- Header -->
	<div class="mb-3 flex items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<div class="flex h-6 w-6 items-center justify-center rounded-full bg-text text-white">
				<Icon icon="Clock" size="14px" />
			</div>
			<h3 class="text-lg font-semibold text-text">Bokningar</h3>
		</div>

		<!-- Navigation Buttons -->
		<div class="flex items-center gap-1">
			<Button icon="ChevronLeft" variant="secondary" iconSize="16px" on:click={onPrevious} />
			<Button text="Idag" variant="secondary" on:click={onToday} />
			<Button icon="ChevronRight" variant="secondary" iconSize="16px" on:click={onNext} />
		</div>
	</div>

	<!-- Content -->
	<p class="mb-2 text-sm font-medium text-gray-500">{formatDateLabel(selectedDate)}</p>
	{#if isLoading}
		<p class="text-sm text-gray-500">Laddar bokningar...</p>
	{:else if bookings.length === 0}
		<p class="text-sm italic text-gray-400">Inga bokningar denna dag 🧘</p>
	{:else}
		<div class="max-h-[280px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
			{#each bookings as booking}
				<ProfileBookingSlot {booking} isClient={false} />
			{/each}
		</div>
	{/if}
</div>
