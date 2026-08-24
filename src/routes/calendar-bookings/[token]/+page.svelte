<script lang="ts">
	import ClientBookingsPage from '../../../components/ui/clientBookingsPage/ClientBookingsPage.svelte';
	import type { FullBooking } from '$lib/types/calendarTypes';

	export let data: {
		syncPageUrl: string;
		bookings: FullBooking[];
	};
</script>

<svelte:head>
	<title>Dina bokningar | Takkei</title>
</svelte:head>

<ClientBookingsPage bookings={data.bookings} syncPageUrl={data.syncPageUrl} privacyMode />
