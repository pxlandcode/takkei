<script lang="ts">
	import Icon from '../../bits/icon-component/Icon.svelte';
	import NotificationsModule from '../../bits/modules-for-mina-sidor/notificationsModule/NotificationsModule.svelte';
	import NoBookingsClientModule from '../../bits/modules-for-mina-sidor/noBookingsClientModule/NoNookingsClientModule.svelte';
	import TodaysBookingsModule from '../../bits/modules-for-mina-sidor/todaysBookingsModule/TodaysBookingsModule.svelte';
	import GoalsAndAchievementsModule from '../../bits/modules-for-mina-sidor/goalsAndAchievementsModule/GoalsAndAchievementsModule.svelte';
	import BookingGrid from '../../ui/bookingGrid/BookingGrid.svelte';
	import { user } from '../../../lib/stores/userStore';
	import Button from '../../bits/button/Button.svelte';
	import BookingPopup from '../../ui/bookingPopup/BookingPopup.svelte';
	import { openPopup } from '$lib/stores/popupStore';

	function openBookingPopup(initialStartTime: Date | null = null) {
		openPopup({
			header: 'Bokning',
			icon: 'Plus',
			component: BookingPopup,
			maxWidth: '650px',
			props: { startTime: initialStartTime }
		});
	}
</script>

<div class="custom-scrollbar m-4 h-full overflow-x-scroll">
	<!-- Greeting -->
	<div class="flex w-full flex-row justify-between">
		<div class="mb-6 flex items-center gap-2">
			<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
				<Icon icon="Person" size="14px" />
			</div>
			<h2 class="text-text text-3xl font-semibold">Hej, {$user?.firstname} 👋</h2>
		</div>
		<Button
			text="Boka"
			iconLeft="Plus"
			variant="primary"
			iconLeftSize="16"
			on:click={() => openBookingPopup(null)}
		/>
	</div>

	<!-- Bento Grid -->
	<div class="flex flex-col gap-4 xl:grid xl:grid-cols-2">
		<NotificationsModule />
		<NoBookingsClientModule />
		<TodaysBookingsModule />

		<GoalsAndAchievementsModule />

		<div class="w-full md:col-span-2">
			<BookingGrid border trainerId={$user?.id} />
		</div>
	</div>
</div>
