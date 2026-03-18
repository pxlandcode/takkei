<script lang="ts">
	import MyStatisticsModule from '../../bits/modules-for-mina-sidor/myStatistics/myStatistics.svelte';
	import BookingGrid from '../../ui/bookingGrid/BookingGrid.svelte';
	import { user } from '$lib/stores/userStore';
	import HomeModernBookings from './modern/HomeModernBookings.svelte';
	import HomeModernClientsWithoutBookings from './modern/HomeModernClientsWithoutBookings.svelte';
	import HomeModernGoals from './modern/HomeModernGoals.svelte';
	import HomeModernHeader from './modern/HomeModernHeader.svelte';
	import HomeModernHolidayPayCard from './modern/HomeModernHolidayPayCard.svelte';
	import HomeModernNotifications from './modern/HomeModernNotifications.svelte';
</script>

<div class="custom-scrollbar h-full overflow-y-auto bg-[#f8f9fb]">
	<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<HomeModernHeader />

		<div class="grid gap-3 lg:grid-cols-3">
			<div class="min-w-0 space-y-3 lg:col-span-2">
				<HomeModernNotifications />
				<HomeModernBookings />
				<MyStatisticsModule variant="modern" />
				<BookingGrid trainerId={$user?.id} />
			</div>

			<div class="min-w-0 space-y-3">
				<HomeModernClientsWithoutBookings />
				<HomeModernGoals />
				<HomeModernHolidayPayCard />
			</div>
		</div>
	</div>
</div>
