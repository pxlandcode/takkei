<script lang="ts">
	import Icon from '../components/bits/icon-component/Icon.svelte';
	import NotificationsModule from '../components/bits/modules-for-mina-sidor/notificationsModule/NotificationsModule.svelte';
	import NoBookingsClientModule from '../components/bits/modules-for-mina-sidor/noBookingsClientModule/NoNookingsClientModule.svelte';
	import { user } from '../lib/stores/userStore';
	import TodaysBookingsModule from '../components/bits/modules-for-mina-sidor/todaysBookingsModule/TodaysBookingsModule.svelte';
	import BookingGrid from '../components/ui/bookingGrid/BookingGrid.svelte';
	import GoalsAndAchievementsModule from '../components/bits/modules-for-mina-sidor/goalsAndAchievementsModule/GoalsAndAchievementsModule.svelte';
	// Components to be created next
</script>

<div class="m-4 h-full overflow-x-scroll custom-scrollbar">
	<!-- Greeting -->
	<div class="mb-6 flex items-center gap-2">
		<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Person" size="14px" />
		</div>
		<h2 class="text-3xl font-semibold text-text">Hej, {$user?.firstname} 👋</h2>
	</div>

	<!-- Bento Grid -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<NotificationsModule />
		<TodaysBookingsModule />
		<NoBookingsClientModule />

		<GoalsAndAchievementsModule />

		<div class="mx-auto md:col-span-2">
			<BookingGrid fullWidth border trainerId={$user?.id} />
		</div>
	</div>
</div>
