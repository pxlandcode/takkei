<script lang="ts">
	import { calendarStore } from '$lib/stores/calendarStore';

	import { onMount } from 'svelte';
	import WeeklyCalendar from '../../components/view/calendar/WeeklyCalendar.svelte';
	import { goto } from '$app/navigation';

	// let calendar;
	// $: week = calendar?.week ?? null;
	// $: bookings = calendar?.bookings ?? [];

	// // Subscribe to store
	// onMount(() => {
	// 	calendarStore.subscribe((c) => (calendar = c));
	// });
</script>

<main>
	<h1>Kalender</h1>

	<div class="p-10">
		<WeeklyCalendar />
	</div>
</main>
