<script lang="ts">
	import ClientBookingsPage from '../../../components/ui/clientBookingsPage/ClientBookingsPage.svelte';

	export let data;
	const { client, bookings } = data;
</script>

<ClientBookingsPage {bookings} clientId={client?.id ?? null} />
