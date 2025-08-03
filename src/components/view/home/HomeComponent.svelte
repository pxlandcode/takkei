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
	import PopupWrapper from '../../ui/popupWrapper/PopupWrapper.svelte';

	let startTime: Date | null = null;
	let bookingOpen = false;

	function closePopup() {
		bookingOpen = false;
	}
</script>

<div class="m-4 h-full overflow-x-scroll custom-scrollbar">
	<!-- Greeting -->
	<div class="flex w-full flex-row justify-between">
		<div class="mb-6 flex items-center gap-2">
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
				<Icon icon="Person" size="14px" />
			</div>
			<h2 class="text-3xl font-semibold text-text">Hej, {$user?.firstname} 👋</h2>
		</div>
		<Button
			text="Boka"
			iconLeft="Plus"
			variant="primary"
			iconLeftSize="16"
			on:click={() => {
				startTime = null;
				bookingOpen = true;
			}}
		/>
	</div>

	<!-- Bento Grid -->
	<div class="flex flex-col gap-4 xl:grid xl:grid-cols-2">
		<NotificationsModule />
		<TodaysBookingsModule />
		<NoBookingsClientModule />
		<GoalsAndAchievementsModule />

		<div class="w-full md:col-span-2">
			<BookingGrid border trainerId={$user?.id} />
		</div>
	</div>
</div>

{#if bookingOpen}
	<PopupWrapper header="Bokning" icon="Plus" on:close={closePopup}>
		<BookingPopup on:close={closePopup} {startTime} />
	</PopupWrapper>
{/if}
