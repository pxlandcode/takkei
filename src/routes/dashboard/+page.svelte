<script lang="ts">
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/userStore';

	$: currentUser = $user;

	async function handleLogout() {
		await fetch('/api/logout', { method: 'POST' });
		user.set(null);
		goto('/login');
	}

	import { onMount } from 'svelte';
	import { fetchBookings, type BookingFilters } from '$lib/services/api/calendarService';
	import WeeklyCalendar from '../../components/view/calendar/WeeklyCalendar.svelte';

	let bookings = [];

	const filters: BookingFilters = {
		week: '2025-01-10',
		locationIds: [69, 70]
	};

	onMount(async () => {
		bookings = await fetchBookings(filters);
		console.log('Bookings:', bookings);
	});
</script>

<main>
	{#if currentUser}
		<h1>Welcome, {currentUser.firstname}!</h1>
		<p>Email: {currentUser.email}</p>
		<button on:click={handleLogout}>Logout</button>
	{:else}
		<p>Loading user data...</p>
	{/if}

	{#if bookings.length > 0}
		<div class="p-10">
			<WeeklyCalendar {bookings} />
		</div>
	{:else}
		<p>Loading bookings...</p>
	{/if}
</main>
