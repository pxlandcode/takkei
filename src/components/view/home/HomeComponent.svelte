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
	import type { ComponentType } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import BookingPopup from '../../ui/bookingPopup/BookingPopup.svelte';
	import { openPopup } from '$lib/stores/popupStore';
	import { fetchHolidayPayForUser } from '$lib/services/api/holidayPayService';
	import HomeAbsencePopup from './HomeAbsencePopup.svelte';
	import { fetchAvailability, saveOrUpdateAbsences } from '$lib/services/api/availabilityService';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import {
		ABSENCE_UPDATED_EVENT,
		dispatchAbsenceUpdated,
		resolveCurrentAbsence,
		type CurrentAbsence as HomeAbsence
	} from '$lib/helpers/availability/currentAbsence';

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
	let currentAbsence: HomeAbsence | null = null;
	let absenceLoading = false;
	let absenceActionLoading = false;
	let hasLoadedAbsence = false;
	let absenceUserId: number | null = null;

	onMount(() => {
		mounted = true;
		const handleAbsenceUpdated = () => {
			if ($user?.kind === 'trainer') {
				loadCurrentAbsence();
			}
		};

		if (typeof window !== 'undefined') {
			window.addEventListener(ABSENCE_UPDATED_EVENT, handleAbsenceUpdated);
		}

		if ($user?.id) {
			loadHolidayPay();
			loadCurrentAbsence();
		}

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener(ABSENCE_UPDATED_EVENT, handleAbsenceUpdated);
			}
		};
	});

	$: if (mounted && $user?.id && !hasLoadedHolidayPay && !holidayPayLoading) {
		loadHolidayPay();
	}

	$: if ($user?.kind === 'trainer' && $user.id !== absenceUserId) {
		absenceUserId = $user.id;
		hasLoadedAbsence = false;
		currentAbsence = null;
	}

	$: if (mounted && $user?.kind === 'trainer' && !hasLoadedAbsence && !absenceLoading) {
		loadCurrentAbsence();
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

	async function loadCurrentAbsence() {
		if ($user?.kind !== 'trainer') return;

		absenceLoading = true;
		try {
			const availability = await fetchAvailability($user.id, { cache: false });
			const absences = Array.isArray(availability?.absences)
				? (availability.absences as HomeAbsence[])
				: [];
			currentAbsence = resolveCurrentAbsence(absences);
		} catch (error) {
			console.error('Failed to load current absence', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte hämta frånvaro',
				description: 'Försök igen om knappen inte visar rätt status.'
			});
		} finally {
			absenceLoading = false;
			hasLoadedAbsence = true;
		}
	}

	async function handleAbsenceStarted() {
		await loadCurrentAbsence();
		addToast({
			type: AppToastType.SUCCESS,
			message: 'Frånvaro registrerad',
			description: 'Frånvaron är nu sparad.'
		});
	}

	function openStartAbsencePopup() {
		if ($user?.kind !== 'trainer') return;

		openPopup({
			header: 'Frånvaro',
			icon: 'Inactive',
			maxWidth: '900px',
			component: HomeAbsencePopup as unknown as ComponentType,
			props: {
				userId: $user.id,
				onSaved: handleAbsenceStarted
			}
		});
	}

	async function endCurrentAbsence() {
		if ($user?.kind !== 'trainer' || !currentAbsence?.id) return;

		absenceActionLoading = true;
		try {
			await saveOrUpdateAbsences($user.id, [
				{
					id: currentAbsence.id,
					end_time: new Date().toISOString(),
					status: 'Closed'
				}
			]);

			dispatchAbsenceUpdated();
			await loadCurrentAbsence();
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Frånvaro avslutad',
				description: 'Den pågående frånvaron är nu avslutad.'
			});
		} catch (error) {
			console.error('Failed to end current absence', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte avsluta frånvaro',
				description: 'Försök igen om en liten stund.'
			});
		} finally {
			absenceActionLoading = false;
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
	<div class="flex w-full flex-wrap items-start justify-between gap-3">
		<div class="mb-6 flex items-center gap-2">
			<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
				<Icon icon="Person" size="14px" />
			</div>
			<h2 class="text-text text-3xl font-semibold">Hej, {$user?.firstname} 👋</h2>
		</div>
		<div class="flex flex-wrap justify-end gap-2">
			{#if $user?.kind === 'trainer'}
				{#if currentAbsence}
					<Button
						text="Avsluta frånvaro"
						iconLeft="Check"
						variant="cancel"
						iconLeftSize="16"
						disabled={absenceLoading || absenceActionLoading}
						confirmOptions={{
							title: 'Avsluta frånvaro?',
							description: currentAbsence.description?.trim()
								? `Frånvaron "${currentAbsence.description.trim()}" avslutas nu.`
								: 'Den pågående frånvaron avslutas nu.',
							action: endCurrentAbsence,
							actionLabel: 'Avsluta'
						}}
					/>
				{:else}
					<Button
						text={absenceLoading && !hasLoadedAbsence ? 'Laddar frånvaro...' : 'Frånvaro'}
						iconLeft="Inactive"
						variant="danger-outline"
						iconLeftSize="16"
						disabled={absenceLoading || absenceActionLoading}
						on:click={openStartAbsencePopup}
					/>
				{/if}
			{/if}
			<Button
				text="Boka"
				iconLeft="Plus"
				variant="primary"
				iconLeftSize="16"
				on:click={() => openBookingPopup(null)}
			/>
		</div>
	</div>

	<!-- Bento Grid -->
	<div class="flex flex-col gap-4 xl:grid xl:grid-cols-2">
		<NotificationsModule />
		<NoBookingsClientModule />
		<div class="col-span-2 grid grid-cols-1 gap-4 xl:h-[500px] xl:grid-cols-2">
			<TodaysBookingsModule />
			<GoalsAndAchievementsModule />
		</div>
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
						<button class="text-primary text-sm underline" on:click={loadHolidayPay}>
							Försök igen
						</button>
					{:else}
						<p class="text-text text-lg font-semibold">
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
