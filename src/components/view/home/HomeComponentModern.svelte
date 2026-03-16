<script lang="ts">
	import Icon from '../../bits/icon-component/Icon.svelte';
	import Button from '../../bits/button/Button.svelte';
	import BookingGrid from '../../ui/bookingGrid/BookingGrid.svelte';
	import BookingPopup from '../../ui/bookingPopup/BookingPopup.svelte';
	import ProfileBookingSlot from '../../ui/profileBookingSlot/ProfileBookingSlot.svelte';
	import ProgressCircle from '../../bits/progress-circle/ProgressCircle.svelte';
	import { user } from '../../../lib/stores/userStore';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import type { ComponentType } from 'svelte';
	import { openPopup } from '$lib/stores/popupStore';
	import { fetchHolidayPayForUser } from '$lib/services/api/holidayPayService';
	import HomeAbsencePopup from './HomeAbsencePopup.svelte';
	import { fetchAvailability, saveOrUpdateAbsences } from '$lib/services/api/availabilityService';
	import { addToast } from '$lib/stores/toastStore';
	import { ripple } from '$lib/actions/ripple';
	import { AppToastType } from '$lib/types/toastTypes';
	import {
		ABSENCE_UPDATED_EVENT,
		dispatchAbsenceUpdated,
		resolveCurrentAbsence,
		type CurrentAbsence as HomeAbsence
	} from '$lib/helpers/availability/currentAbsence';
	import { fetchBookings } from '$lib/services/api/calendarService';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import BookingDetailsPopup from '../../ui/bookingDetailsPopup/BookingDetailsPopup.svelte';
	import { notificationStore } from '$lib/stores/notificationStore';
	import { cacheFirstJson, invalidateByPrefix } from '$lib/services/api/apiCache';
	import {
		targetMeta,
		updateTargets,
		locationTargetMeta,
		updateLocationTargets,
		companyTargetMeta,
		updateCompanyTargets
	} from '$lib/stores/targetsStore';
	import { updateAchievements } from '$lib/stores/achievementsStore';
	import type { TrainerStatisticsResponse } from '$lib/api/statistics';
	import { tooltip } from '$lib/actions/tooltip';

	// ========== Booking Popup ==========
	function openBookingPopup(initialStartTime: Date | null = null) {
		openPopup({
			header: 'Bokning',
			icon: 'Plus',
			component: BookingPopup,
			maxWidth: '650px',
			props: { startTime: initialStartTime }
		});
	}

	// ========== Holiday Pay ==========
	let mounted = false;
	let holidayPayAmount: number | null = null;
	let holidayPayLoading = false;
	let hasLoadedHolidayPay = false;

	// ========== Absence ==========
	let currentAbsence: HomeAbsence | null = null;
	let absenceLoading = false;
	let absenceActionLoading = false;
	let hasLoadedAbsence = false;
	let absenceUserId: number | null = null;

	// ========== Today's Bookings ==========
	let bookings: FullBooking[] = [];
	let bookingsLoading = true;
	let selectedDate = new Date();

	const cancelledStatuses = new Set(['Cancelled', 'Late_cancelled', 'CancelledLate']);
	function isCancelledStatus(status?: string | null): boolean {
		if (!status) return false;
		return cancelledStatuses.has(status);
	}
	$: activeBookings = bookings.filter((b) => !isCancelledStatus(b.booking.status));

	// ========== Notifications ==========
	interface NotificationEvent {
		id: number;
		name: string;
		description: string;
		event_type: string;
		start_time: string;
		end_time?: string | null;
		done?: boolean;
		created_by?: { name?: string } | null;
		link?: string | null;
	}
	let allEvents: NotificationEvent[] = [];
	let events: NotificationEvent[] = [];
	let notificationsLoading = true;
	let notificationsRequested = false;
	let markingDoneId: number | null = null;
	let dismissTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// ========== Clients without bookings ==========
	interface Client {
		id: number;
		firstname: string;
		lastname: string;
		lastBookingDate?: string | null;
	}
	let clientsThisWeek: Client[] = [];
	let clientsNextWeek: Client[] = [];
	let clientsWeekAfter: Client[] = [];
	let clientsLoading = true;

	// ========== Statistics ==========
	let statistics: TrainerStatisticsResponse | null = null;
	let trainerId: number | null = null;

	// ========== Date Helpers ==========
	const TZ = 'Europe/Stockholm';
	function ymdStockholm(d: Date): string {
		const parts = new Intl.DateTimeFormat('sv-SE', {
			timeZone: TZ,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		})
			.formatToParts(d)
			.reduce((a, p) => ((a[p.type] = p.value), a), {} as Record<string, string>);
		return `${parts.year}-${parts.month}-${parts.day}`;
	}
	function dayParam(d: Date) {
		return `${ymdStockholm(d)} 12:00:00`;
	}

	function formatDate(date: Date): string {
		return date.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
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

	function relativeTime(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return 'just nu';
		if (minutes < 60) return `${minutes} min sen`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h sen`;
		const days = Math.floor(hours / 24);
		return `${days}d sen`;
	}

	// ========== Mount and Load ==========
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
			loadBookings();
			fetchNotifications();
			fetchClientsWithoutBookings();
			loadStatistics();
			loadTargets();
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

	// ========== Data Loading Functions ==========
	async function loadHolidayPay() {
		if (!$user?.id) return;
		holidayPayLoading = true;
		try {
			const entry = await fetchHolidayPayForUser();
			holidayPayAmount = entry?.amount ?? 0;
		} catch (error) {
			console.error('Failed to load holiday pay', error);
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
		} finally {
			absenceLoading = false;
			hasLoadedAbsence = true;
		}
	}

	function addDays(d: Date, n: number) {
		const x = new Date(d);
		x.setDate(x.getDate() + n);
		return x;
	}

	async function loadBookings() {
		if (!$user?.id) return;
		bookingsLoading = true;
		try {
			const from = dayParam(selectedDate);
			const to = dayParam(addDays(selectedDate, 1));
			const filters = {
				from,
				to,
				trainerIds: [$user.id],
				sortAsc: true,
				personalBookings: true
			};
			bookings = await fetchBookings(filters, fetch, undefined, 0, true);
		} catch (error) {
			console.error('Failed to load bookings', error);
		} finally {
			bookingsLoading = false;
		}
	}

	async function fetchNotifications() {
		if (!$user?.id || notificationsRequested) return;
		notificationsRequested = true;
		notificationsLoading = true;

		const url = `/api/notifications?user_id=${$user.id}`;
		const { cached, fresh } = cacheFirstJson<NotificationEvent[]>(fetch, url);

		if (cached) {
			const all = cached
				.filter((e) => !e.done)
				.sort((a, b) => {
					if (a.event_type === 'alert' && b.event_type !== 'alert') return -1;
					if (a.event_type !== 'alert' && b.event_type === 'alert') return 1;
					return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
				});
			allEvents = all;
			events = allEvents.slice(0, 3);
			notificationsLoading = false;
		}

		fresh
			.then((all) => {
				allEvents = all
					.filter((e) => !e.done)
					.sort((a, b) => {
						if (a.event_type === 'alert' && b.event_type !== 'alert') return -1;
						if (a.event_type !== 'alert' && b.event_type === 'alert') return 1;
						return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
					});
				events = allEvents.slice(0, 3);
			})
			.catch(() => {})
			.finally(() => {
				notificationsLoading = false;
			});
	}

	async function fetchClientsWithoutBookings() {
		if (!$user?.id) return;
		clientsLoading = true;

		const url = `/api/clients-without-bookings?trainer_id=${$user.id}`;
		const { cached, fresh } = cacheFirstJson<{
			thisWeek: Client[];
			week1: Client[];
			week2: Client[];
		}>(fetch, url);

		if (cached) {
			clientsThisWeek = cached.thisWeek ?? [];
			clientsNextWeek = cached.week1 ?? [];
			clientsWeekAfter = cached.week2 ?? [];
			clientsLoading = false;
		}

		fresh
			.then((data) => {
				clientsThisWeek = data.thisWeek ?? [];
				clientsNextWeek = data.week1 ?? [];
				clientsWeekAfter = data.week2 ?? [];
			})
			.catch(() => {})
			.finally(() => {
				clientsLoading = false;
			});
	}

	async function loadStatistics() {
		if (!$user?.id) return;
		trainerId = $user.id;

		try {
			const url = `/api/statistics?trainerId=${trainerId}`;
			const { cached, fresh } = cacheFirstJson<TrainerStatisticsResponse>(fetch, url);

			if (cached) {
				statistics = cached;
			}

			const data = await fresh;
			statistics = data;
		} catch (err) {
			console.error('Failed to load statistics', err);
		}
	}

	function loadTargets() {
		if (!$user?.id) return;
		const formattedDate = selectedDate.toISOString().slice(0, 10);
		updateTargets('trainer', $user.id, formattedDate);
		updateAchievements($user.id, formattedDate);

		const defaultLocationId = $user.kind === 'trainer' ? Number($user.default_location_id ?? 0) : 0;
		if (defaultLocationId > 0) {
			updateLocationTargets(defaultLocationId, formattedDate);
		}
		updateCompanyTargets(formattedDate);
	}

	// ========== Action Handlers ==========
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
			console.error('Failed to end absence', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte avsluta frånvaro',
				description: 'Försök igen om en liten stund.'
			});
		} finally {
			absenceActionLoading = false;
		}
	}

	async function markNotificationDone(eventId: number) {
		// If already marking this one, dismiss immediately
		if (markingDoneId === eventId) {
			if (dismissTimeoutId) {
				clearTimeout(dismissTimeoutId);
				dismissTimeoutId = null;
			}
			removeNotification(eventId);
			return;
		}

		markingDoneId = eventId;

		try {
			const res = await fetch('/api/notifications', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ event_id: eventId, user_id: $user?.id })
			});
			if (!res.ok) throw new Error('Kunde inte uppdatera');

			// Wait for ripple animation to complete before removing
			dismissTimeoutId = setTimeout(() => {
				removeNotification(eventId);
			}, 300);
		} catch (err) {
			markingDoneId = null;
			addToast({
				type: AppToastType.CANCEL,
				message: 'Fel vid uppdatering',
				description: err instanceof Error ? err.message : 'Något gick fel.'
			});
		}
	}

	function removeNotification(eventId: number) {
		allEvents = allEvents.filter((event) => event.id !== eventId);
		events = allEvents.slice(0, 3);
		invalidateByPrefix('/api/notifications');
		if ($user?.id) notificationStore.updateFromServer($user.id);
		markingDoneId = null;
		dismissTimeoutId = null;
	}

	function openBookingDetails(booking: FullBooking) {
		openPopup({
			header: 'Bokningsdetaljer',
			icon: 'Calendar',
			component: BookingDetailsPopup as unknown as ComponentType,
			maxWidth: '650px',
			props: { booking }
		});
	}

	$: totalMissingClients =
		clientsThisWeek.length + clientsNextWeek.length + clientsWeekAfter.length;
</script>

<div class="custom-scrollbar h-full overflow-y-auto bg-[#f8f9fb]">
	<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<!-- Header Section -->
		<header class="mb-8">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="text-sm font-medium text-gray-500 capitalize">{formatDate(new Date())}</p>
					<h1 class="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
						Hej, {$user?.firstname} 👋
					</h1>
				</div>
				<div class="flex flex-wrap gap-2">
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
								text={absenceLoading && !hasLoadedAbsence ? 'Laddar...' : 'Frånvaro'}
								iconLeft="Inactive"
								variant="danger-outline"
								iconLeftSize="16"
								disabled={absenceLoading || absenceActionLoading}
								on:click={openStartAbsencePopup}
							/>
						{/if}
					{/if}
					<Button
						text="Ny bokning"
						iconLeft="Plus"
						variant="primary"
						iconLeftSize="16"
						on:click={() => openBookingPopup(null)}
					/>
				</div>
			</div>
		</header>

		<!-- Quick Stats Row -->
		<section class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
			<!-- Today's Bookings Count -->
			<div class="bg-white p-4 shadow-sm transition hover:shadow-md">
				<div class="flex items-center gap-3">
					<div class="bg-primary/10 flex h-10 w-10 items-center justify-center">
						<Icon icon="Calendar" size="20px" color="primary" />
					</div>
					<div>
						<p class="text-2xl font-bold text-gray-900">
							{bookingsLoading ? '–' : activeBookings.length}
						</p>
						<p class="text-xs text-gray-500">Bokningar idag</p>
					</div>
				</div>
			</div>

			<!-- Notifications Count -->
			<div class="bg-white p-4 shadow-sm transition hover:shadow-md">
				<div class="flex items-center gap-3">
					<div class="bg-red/10 flex h-10 w-10 items-center justify-center">
						<Icon icon="Notification" size="20px" color="red" />
					</div>
					<div>
						<p class="text-2xl font-bold text-gray-900">
							{notificationsLoading ? '–' : allEvents.length}
						</p>
						<p class="text-xs text-gray-500">Notiser</p>
					</div>
				</div>
			</div>

			<!-- Clients Missing Bookings -->
			<div class="bg-white p-4 shadow-sm transition hover:shadow-md">
				<div class="flex items-center gap-3">
					<div class="bg-orange/10 flex h-10 w-10 items-center justify-center">
						<Icon icon="Person" size="20px" color="orange" />
					</div>
					<div>
						<p class="text-2xl font-bold text-gray-900">
							{clientsLoading ? '–' : totalMissingClients}
						</p>
						<p class="text-xs text-gray-500">Saknar bokning</p>
					</div>
				</div>
			</div>

			<!-- Holiday Pay -->
			<div class="bg-white p-4 shadow-sm transition hover:shadow-md">
				<div class="flex items-center gap-3">
					<div class="bg-green/10 flex h-10 w-10 items-center justify-center">
						<Icon icon="Money" size="20px" color="green" />
					</div>
					<div>
						<p class="text-2xl font-bold text-gray-900">
							{holidayPayLoading && !hasLoadedHolidayPay ? '–' : formatCurrency(holidayPayAmount)}
						</p>
						<p class="text-xs text-gray-500">Semesterersättning</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Main Grid -->
		<div class="grid gap-3 lg:grid-cols-3">
			<!-- Left Column -->
			<div class="space-y-3 lg:col-span-2">
				<!-- Notifications -->
				{#if !notificationsLoading && events.length > 0}
					<section class="bg-white p-4 shadow-sm">
						<div class="mb-3 flex items-center justify-between">
							<h2 class="flex items-center gap-2 text-lg font-semibold text-gray-900">
								<Icon icon="Notification" size="18px" color="primary" />
								Notiser
								<span class="bg-red/10 text-red px-1.5 py-0.5 text-xs font-medium">
									{allEvents.length}
								</span>
							</h2>
							<a href="/notifications" class="text-primary text-sm font-medium hover:underline">
								Visa alla →
							</a>
						</div>
						<div class="divide-y divide-gray-100">
							{#each events as event (event.id)}
								{@const typeColor =
									event.event_type === 'client'
										? 'bg-orange'
										: event.event_type === 'alert'
											? 'bg-red'
											: event.event_type === 'info'
												? 'bg-green'
												: event.event_type === 'article'
													? 'bg-primary'
													: 'bg-gray-400'}
								{@const isMarking = markingDoneId === event.id}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="notification-row group relative flex items-center gap-2 overflow-hidden py-2"
									class:cursor-pointer={isMarking}
									transition:slide={{ duration: 300 }}
									use:ripple={{ color: '#22c55e', opacity: 0.25, duration: 800 }}
									on:click={() => isMarking && markNotificationDone(event.id)}
									on:keydown={(e) =>
										e.key === 'Enter' && isMarking && markNotificationDone(event.id)}
								>
									<div class="h-2 w-2 flex-shrink-0 {typeColor}"></div>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="truncate text-xs font-medium text-gray-900">{event.name}</span>
											<span class="flex-shrink-0 text-[10px] text-gray-400"
												>{relativeTime(event.start_time)}</span
											>
										</div>
										{#if event.description}
											<p class="truncate text-[11px] text-gray-500">{event.description}</p>
										{/if}
									</div>
									<button
										class="hover:bg-green/10 flex h-6 w-6 flex-shrink-0 items-center justify-center text-base text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-green-600"
										on:click|stopPropagation={() => markNotificationDone(event.id)}
									>
										✓
									</button>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Today's Bookings -->
				<section class="bg-white p-5 shadow-sm">
					<div class="mb-4 flex items-center justify-between">
						<h2 class="flex items-center gap-2 text-lg font-semibold text-gray-900">
							<Icon icon="Calendar" size="18px" color="primary" />
							Dagens bokningar
						</h2>
						<a href="/calendar" class="text-primary text-sm font-medium hover:underline">
							Visa kalender →
						</a>
					</div>
					{#if bookingsLoading}
						<div class="flex h-32 items-center justify-center">
							<div
								class="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
							></div>
						</div>
					{:else if activeBookings.length === 0}
						<div class="flex h-32 flex-col items-center justify-center text-gray-400">
							<Icon icon="Calendar" size="32px" />
							<p class="mt-2 text-sm">Inga bokningar idag</p>
						</div>
					{:else}
						<div class="space-y-2">
							{#each activeBookings.slice(0, 5) as booking}
								<div
									class="w-full cursor-pointer"
									on:click={() => openBookingDetails(booking)}
									on:keydown={(e) => e.key === 'Enter' && openBookingDetails(booking)}
									role="button"
									tabindex="0"
								>
									<ProfileBookingSlot {booking} />
								</div>
							{/each}
							{#if activeBookings.length > 5}
								<p class="pt-2 text-center text-sm text-gray-500">
									+{activeBookings.length - 5} fler bokningar
								</p>
							{/if}
						</div>
					{/if}
				</section>

				<!-- Booking Grid -->
				<BookingGrid trainerId={$user?.id} />
			</div>

			<!-- Right Column -->
			<div class="space-y-3">
				<!-- Goals Progress -->
				<section class="bg-white p-5 shadow-sm">
					<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
						<Icon icon="Trophy" size="18px" color="primary" />
						Mål
					</h2>
					<div class="space-y-4">
						<!-- Mina mål -->
						{#if $targetMeta}
							<div>
								<div class="mb-2 flex items-center gap-1">
									<Icon icon="Person" size="14px" color="primary" />
									<span class="text-xs font-medium text-gray-600">Mina mål</span>
								</div>
								<div class="grid grid-cols-3 gap-2 text-center">
									<div
										use:tooltip={{
											content: `Årsmål: ${$targetMeta.yearGoal ?? 0}\nUppnått: ${$targetMeta.achievedYear}`
										}}
									>
										<ProgressCircle
											value={$targetMeta.achievedYear}
											max={$targetMeta.yearGoal ?? 0}
											size={72}
											strokeWidth={6}
										/>
										<p class="mt-1 text-[10px] text-gray-400">År</p>
									</div>
									<div
										use:tooltip={{
											content: `Månadsmål: ${$targetMeta.monthGoal ?? 0}\nUppnått: ${$targetMeta.achievedMonth}`
										}}
									>
										<ProgressCircle
											value={$targetMeta.achievedMonth}
											max={$targetMeta.monthGoal ?? 0}
											size={72}
											strokeWidth={6}
										/>
										<p class="mt-1 text-[10px] text-gray-400">Månad</p>
									</div>
									<div
										use:tooltip={{
											content: `Veckomål: ${$targetMeta.weekGoal ?? 0}\nUppnått: ${$targetMeta.achievedWeek}`
										}}
									>
										<ProgressCircle
											value={$targetMeta.achievedWeek}
											max={$targetMeta.weekGoal ?? 0}
											size={72}
											strokeWidth={6}
										/>
										<p class="mt-1 text-[10px] text-gray-400">Vecka</p>
									</div>
								</div>
							</div>
						{/if}

						<!-- Location -->
						{#if $locationTargetMeta && ($locationTargetMeta.yearGoal !== null || $locationTargetMeta.monthGoal !== null)}
							<div>
								<div
									class="mb-2 flex items-center gap-1"
									title={$locationTargetMeta.locationName ?? 'Plats'}
								>
									<Icon icon="Building" size="14px" color="primary" />
									<span class="text-xs font-medium text-gray-600">
										{$locationTargetMeta.locationName ?? 'Plats'}
									</span>
								</div>
								<div class="grid grid-cols-3 gap-2 text-center">
									<div
										use:tooltip={{
											content: `Årsmål: ${$locationTargetMeta.yearGoal ?? 0}\nUppnått: ${$locationTargetMeta.achievedYear}`
										}}
									>
										<ProgressCircle
											value={$locationTargetMeta.achievedYear}
											max={$locationTargetMeta.yearGoal ?? 0}
											size={72}
											strokeWidth={6}
										/>
										<p class="mt-1 text-[10px] text-gray-400">År</p>
									</div>
									<div
										use:tooltip={{
											content: `Månadsmål: ${$locationTargetMeta.monthGoal ?? 0}\nUppnått: ${$locationTargetMeta.achievedMonth}`
										}}
									>
										<ProgressCircle
											value={$locationTargetMeta.achievedMonth}
											max={$locationTargetMeta.monthGoal ?? 0}
											size={72}
											strokeWidth={6}
										/>
										<p class="mt-1 text-[10px] text-gray-400">Månad</p>
									</div>
									<div
										use:tooltip={{
											content: `Veckomål: ${$locationTargetMeta.weekGoal ?? 0}\nUppnått: ${$locationTargetMeta.achievedWeek}`
										}}
									>
										<ProgressCircle
											value={$locationTargetMeta.achievedWeek}
											max={$locationTargetMeta.weekGoal ?? 0}
											size={72}
											strokeWidth={6}
										/>
										<p class="mt-1 text-[10px] text-gray-400">Vecka</p>
									</div>
								</div>
							</div>
						{/if}

						<!-- Takkei -->
						{#if $companyTargetMeta}
							<div>
								<div class="mb-2 flex items-center gap-1">
									<Icon icon="Takkei" size="14px" color="primary" />
									<span class="text-xs font-medium text-gray-600">Takkei</span>
								</div>
								<div class="grid grid-cols-3 gap-2 text-center">
									<div
										use:tooltip={{
											content: `Årsmål: ${$companyTargetMeta.yearGoal ?? 0}\nUppnått: ${$companyTargetMeta.achievedYear}`
										}}
									>
										<ProgressCircle
											value={$companyTargetMeta.achievedYear}
											max={$companyTargetMeta.yearGoal ?? 0}
											size={72}
											strokeWidth={6}
										/>
										<p class="mt-1 text-[10px] text-gray-400">År</p>
									</div>
									<div
										use:tooltip={{
											content: `Månadsmål: ${$companyTargetMeta.monthGoal ?? 0}\nUppnått: ${$companyTargetMeta.achievedMonth}`
										}}
									>
										<ProgressCircle
											value={$companyTargetMeta.achievedMonth}
											max={$companyTargetMeta.monthGoal ?? 0}
											size={72}
											strokeWidth={6}
										/>
										<p class="mt-1 text-[10px] text-gray-400">Månad</p>
									</div>
									<div
										use:tooltip={{
											content: `Veckomål: ${$companyTargetMeta.weekGoal ?? 0}\nUppnått: ${$companyTargetMeta.achievedWeek}`
										}}
									>
										<ProgressCircle
											value={$companyTargetMeta.achievedWeek}
											max={$companyTargetMeta.weekGoal ?? 0}
											size={72}
											strokeWidth={6}
										/>
										<p class="mt-1 text-[10px] text-gray-400">Vecka</p>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</section>

				<!-- Clients without bookings -->
				<section class="bg-white p-5 shadow-sm">
					<div class="mb-4 flex items-center justify-between">
						<h2 class="flex items-center gap-2 text-lg font-semibold text-gray-900">
							<Icon icon="Person" size="18px" color="primary" />
							Utan bokning
						</h2>
						<span class="bg-orange/10 text-orange px-2 py-0.5 text-xs font-medium">
							{totalMissingClients} klienter
						</span>
					</div>
					{#if clientsLoading}
						<div class="flex h-24 items-center justify-center">
							<div
								class="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
							></div>
						</div>
					{:else if totalMissingClients === 0}
						<div class="flex h-24 flex-col items-center justify-center text-gray-400">
							<Icon icon="Check" size="24px" />
							<p class="mt-1 text-sm">Alla har bokningar!</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#if clientsThisWeek.length > 0}
								<div>
									<p class="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
										Denna vecka ({clientsThisWeek.length})
									</p>
									<div class="flex flex-wrap gap-1">
										{#each clientsThisWeek.slice(0, 4) as client}
											<a
												href="/clients/{client.id}"
												class="bg-red/10 hover:bg-red/20 px-2 py-1 text-xs font-medium text-red-800 transition"
											>
												{client.firstname}
											</a>
										{/each}
										{#if clientsThisWeek.length > 4}
											<span class="px-2 py-1 text-xs text-gray-400">
												+{clientsThisWeek.length - 4}
											</span>
										{/if}
									</div>
								</div>
							{/if}
							{#if clientsNextWeek.length > 0}
								<div>
									<p class="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
										Nästa vecka ({clientsNextWeek.length})
									</p>
									<div class="flex flex-wrap gap-1">
										{#each clientsNextWeek.slice(0, 4) as client}
											<a
												href="/clients/{client.id}"
												class="bg-orange/10 text-orange hover:bg-orange/20 px-2 py-1 text-xs font-medium transition"
											>
												{client.firstname}
											</a>
										{/each}
										{#if clientsNextWeek.length > 4}
											<span class="px-2 py-1 text-xs text-gray-400">
												+{clientsNextWeek.length - 4}
											</span>
										{/if}
									</div>
								</div>
							{/if}
							{#if clientsWeekAfter.length > 0}
								<div>
									<p class="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
										Om 2 veckor ({clientsWeekAfter.length})
									</p>
									<div class="flex flex-wrap gap-1">
										{#each clientsWeekAfter.slice(0, 4) as client}
											<a
												href="/clients/{client.id}"
												class="bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200"
											>
												{client.firstname}
											</a>
										{/each}
										{#if clientsWeekAfter.length > 4}
											<span class="px-2 py-1 text-xs text-gray-400">
												+{clientsWeekAfter.length - 4}
											</span>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</section>

				<!-- Statistics Summary -->
				{#if statistics}
					<section class="bg-white p-5 shadow-sm">
						<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
							<Icon icon="Graph" size="18px" color="primary" />
							Statistik
						</h2>
						<div class="space-y-3">
							<div class="flex items-center justify-between">
								<span class="text-sm text-gray-600">Timmar denna månad</span>
								<span class="font-semibold text-gray-900">
									{statistics.debiteradePass?.periods?.month?.hours ?? 0}h
								</span>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-sm text-gray-600">Timmar denna vecka</span>
								<span class="font-semibold text-gray-900">
									{statistics.debiteradePass?.periods?.week?.hours ?? 0}h
								</span>
							</div>
							{#if statistics.avbokningar}
								<div class="flex items-center justify-between">
									<span class="text-sm text-gray-600">Avbokningar (mån)</span>
									<span class="font-semibold text-gray-900">
										{statistics.avbokningar.month?.total ?? 0}
									</span>
								</div>
							{/if}
						</div>
					</section>
				{/if}
			</div>
		</div>
	</div>
</div>
