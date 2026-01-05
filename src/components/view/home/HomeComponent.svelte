<script lang="ts">
	import Icon from '../../bits/icon-component/Icon.svelte';
	import NotificationsModule from '../../bits/modules-for-mina-sidor/notificationsModule/NotificationsModule.svelte';
	import NoBookingsClientModule from '../../bits/modules-for-mina-sidor/noBookingsClientModule/NoNookingsClientModule.svelte';
	import TodaysBookingsModule from '../../bits/modules-for-mina-sidor/todaysBookingsModule/TodaysBookingsModule.svelte';
	import MyStatisticsModule from '../../bits/modules-for-mina-sidor/myStatistics/myStatistics.svelte';
	import GoalsAndAchievementsModule from '../../bits/modules-for-mina-sidor/goalsAndAchievementsModule/GoalsAndAchievementsModule.svelte';
	import BookingGrid from '../../ui/bookingGrid/BookingGrid.svelte';
	import { user } from '../../../lib/stores/userStore';
	import { onMount } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import BookingPopup from '../../ui/bookingPopup/BookingPopup.svelte';
	import { openPopup } from '$lib/stores/popupStore';
	import { fetchHolidayPayForUser } from '$lib/services/api/holidayPayService';

	function openBookingPopup(initialStartTime: Date | null = null) {
		openPopup({
			header: 'Bokning',
			icon: 'Plus',
			component: BookingPopup,
			maxWidth: '650px',
			props: { startTime: initialStartTime }
		});
	}

	let mounted = false;
	let holidayPayAmount: number | null = null;
	let holidayPayUpdatedAt: string | null = null;
	let holidayPayLoading = false;
	let holidayPayError: string | null = null;
	let hasLoadedHolidayPay = false;

	onMount(() => {
		mounted = true;
		if ($user?.id) {
			loadHolidayPay();
		}
	});

	$: if (mounted && $user?.id && !hasLoadedHolidayPay && !holidayPayLoading) {
		loadHolidayPay();
	}

	async function loadHolidayPay() {
		if (!$user?.id) return;
		holidayPayLoading = true;
		holidayPayError = null;
		try {
			const entry = await fetchHolidayPayForUser();
			holidayPayAmount = entry?.amount ?? 0;
			holidayPayUpdatedAt = entry?.updatedAt ?? entry?.createdAt ?? null;
		} catch (error) {
			console.error('Failed to load holiday pay', error);
			holidayPayError = 'Kunde inte hämta semesterersättning just nu.';
		} finally {
			holidayPayLoading = false;
			hasLoadedHolidayPay = true;
		}
	}

	function formatCurrency(value: number | null) {
		if (!Number.isFinite(value ?? NaN)) return '–';
		return new Intl.NumberFormat('sv-SE', {
			style: 'currency',
			currency: 'SEK',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(value ?? 0);
	}

	function formatUpdatedAt(value: string | null) {
		if (!value) return 'Inte uppdaterad ännu';
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		return parsed.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
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
		<div class="w-full xl:col-span-2">
			<MyStatisticsModule />
		</div>

		<div class="w-full md:col-span-2">
			<BookingGrid border trainerId={$user?.id} />
		</div>
	</div>

	<div class="mt-4 w-full md:w-1/2">
		<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-md">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="flex items-center gap-2">
					<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
						<Icon icon="Money" size="14px" />
					</div>
					<div>
						<p class="text-sm font-semibold text-gray-900">Semesterersättning</p>
						<p class="text-xs text-gray-500">Ackumulerat saldo</p>
					</div>
				</div>
				<div class="text-right">
					{#if holidayPayLoading && !hasLoadedHolidayPay}
						<p class="text-sm text-gray-500">Laddar...</p>
					{:else if holidayPayError}
						<button class="text-sm text-primary underline" on:click={loadHolidayPay}>
							Försök igen
						</button>
					{:else}
						<p class="text-lg font-semibold text-text">
							{formatCurrency(holidayPayAmount)}
						</p>
					{/if}
				</div>
			</div>
			<div class="mt-2 text-xs text-gray-600">
				{#if holidayPayError}
					{holidayPayError}
				{:else if holidayPayLoading && !hasLoadedHolidayPay}
					Hämtar senaste värdet...
				{:else}
					{holidayPayUpdatedAt
						? `Senast uppdaterad ${formatUpdatedAt(holidayPayUpdatedAt)}`
						: 'Ingen uppdatering registrerad ännu.'}
				{/if}
			</div>
		</div>
	</div>
</div>
