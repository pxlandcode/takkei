<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchBookings, type BookingFilters } from '$lib/services/api/calendarService';
	import WeeklyCalendar from '../../components/view/calendar/WeeklyCalendar.svelte';

	let bookings = [];

	const filters: BookingFilters = {
		week: '2024-12-22'
	};

	onMount(async () => {
		bookings = await fetchBookings(filters);
		console.log('Bookings:', bookings);
	});
</script>

{#if bookings.length > 0}
	<WeeklyCalendar {bookings} />
{:else}
	<p>Loading bookings...</p>
{/if}
