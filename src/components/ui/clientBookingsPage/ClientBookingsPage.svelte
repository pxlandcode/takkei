<script lang="ts">
	import type { FullBooking } from '$lib/types/calendarTypes';
	import ProfileBookingList from '../profileBookingList/ProfileBookingList.svelte';

	export let bookings: FullBooking[] = [];
	export let clientId: number | null = null;
	export let syncPageUrl: string | null = null;
	export let privacyMode = false;
	export let allowCancelledBookings = true;
</script>

<div class="flex flex-1 flex-col gap-6 p-6">
	<header class="flex flex-col gap-2 border-b border-gray-200 pb-4">
		<h1 class="text-3xl font-semibold text-gray-900">Planerade och tidigare pass</h1>
		<p class="text-sm text-gray-600">
			Här kan du se dina kommande tider och historik. Kontakta din tränare om något behöver
			uppdateras.
		</p>
	</header>

	<section class="rounded-sm border border-gray-200 bg-white p-6 shadow-md">
		<ProfileBookingList
			{bookings}
			{clientId}
			{syncPageUrl}
			{privacyMode}
			{allowCancelledBookings}
		/>
	</section>
</div>
