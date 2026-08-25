<script lang="ts">
	import { onMount } from 'svelte';
	import type { ComponentType } from 'svelte';
	import { fetchBookings } from '$lib/services/api/calendarService';
	import { writable, get } from 'svelte/store';
	import { cancelBooking } from '$lib/services/api/bookingService';
	import { fetchClients, getClientEmails } from '$lib/stores/clientsStore';
	import { fetchUsers, getUserEmails } from '$lib/stores/usersStore';
	import { sendMail } from '$lib/services/mail/mailClientService';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import {
		BOOKING_EMAIL_RECIPIENT_DEFAULT,
		BOOKING_EMAIL_RECIPIENT_OPTIONS,
		buildBookingConfirmationEmailBody,
		handleBookingEmail,
		requireClientCalendarEmailLinks,
		resolveBookingConfirmationRecipients,
		type BookingEmailRecipientTarget,
		type ClientCalendarEmailLinks
	} from '$lib/helpers/bookingHelpers/bookingHelpers';

	import ProfileBookingSlot from '../profileBookingSlot/ProfileBookingSlot.svelte';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { openPopup } from '$lib/stores/popupStore';
	import { user } from '$lib/stores/userStore';
	import { debounce } from '$lib/utils/debounce';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import BookingDetailsPopup from '../bookingDetailsPopup/BookingDetailsPopup.svelte';
	import MailComponent from '../mailComponent/MailComponent.svelte';
	import type { FullBooking } from '$lib/types/calendarTypes';

	type CancelEmailBehavior = 'send' | 'edit' | 'none';
	type CancelledOption = { value: boolean; label: string };
	type BookedDate = { date: string; time: string; locationName?: string };
	type CancelConfirmOptions = {
		onConfirm: (reason: string, time: string, emailBehavior: CancelEmailBehavior) => void;
		startTimeISO: string;
		defaultEmailBehavior?: CancelEmailBehavior;
	} | null;

	export let trainerId: number | null = null;
	export let clientId: number | null = null;
	export let clientIds: number[] = [];
	export let client: any = null;
	// ✅ Reactive Stores
	let bookings = writable<FullBooking[]>([]);
	let page = writable(0);
	let isLoading = writable(false);
	let hasMore = writable(true);
	let selectAllChecked = false;

	let selectedBookings = writable<FullBooking[]>([]);
	let cancelableSelected: FullBooking[] = [];
	let cancelConfirmStartTimeISO = new Date().toISOString();
	let cancelConfirmOptions: CancelConfirmOptions = null;

	const CANCELLED_STATUSES = new Set(['cancelled', 'late_cancelled']);

	const debouncedLoad = debounce((val: string) => {
		if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
			loadMoreBookings(true);
		}
	}, 300);

	let normalizedClientIds: number[] = [];
	let isClient = false;
	let showBookingActions = false;
	let profileScopeKey = '';
	let lastProfileScopeKey = '';
	let hasMounted = false;

	function normalizeClientIds(clientId: number | null, clientIds: number[]): number[] {
		if (clientId !== null && Number.isFinite(clientId) && clientId > 0) return [clientId];
		const ids = Array.isArray(clientIds) ? clientIds : [];
		return [
			...new Set(ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))
		].sort((a, b) => a - b);
	}

	$: normalizedClientIds = normalizeClientIds(clientId, clientIds);
	$: isClient = clientId !== null && Number.isFinite(clientId) && clientId > 0;
	$: showBookingActions = isClient || normalizedClientIds.length > 0;
	$: profileScopeKey = JSON.stringify({
		trainerId: trainerId ?? null,
		clientIds: normalizedClientIds
	});

	function ymdNoon(d: Date): string {
		const x = new Date(d);
		x.setHours(12, 0, 0, 0); // local noon avoids UTC day flip
		return x.toISOString().slice(0, 10);
	}
	function addDays(d: Date, n: number) {
		const x = new Date(d);
		x.setDate(x.getDate() + n);
		return x;
	}
	function dayParam(ymd: string) {
		return `${ymd} 12:00:00`;
	}
	const TZ = 'Europe/Stockholm';

	// ✅ Filters
	const today = new Date();
	const oneMonthBack = new Date(today);
	oneMonthBack.setMonth(today.getMonth() - 1);

	let selectedDate = writable(ymdNoon(today));
	let selectedCancelledOption = writable<CancelledOption>({
		value: false,
		label: 'Visa inte avbokade'
	});

	$: if (!hasMounted && normalizedClientIds.length > 0) {
		selectedDate.set(ymdNoon(oneMonthBack));
	}

	const LIMIT = 20;

	function allLoadedSelected() {
		const all = get(bookings);
		const selIds = new Set(get(selectedBookings).map((b) => b.booking.id));
		return all.length > 0 && all.every((b) => selIds.has(b.booking.id));
	}

	function clearAllSelected() {
		selectedBookings.set([]);
	}

	function isCancelledBooking(booking: FullBooking) {
		const status = String(booking?.booking?.status ?? '').toLowerCase();
		return CANCELLED_STATUSES.has(status) || Boolean(booking?.booking?.cancelTime);
	}

	function getEarliestStartTime(bookings: FullBooking[]) {
		let earliest = Number.POSITIVE_INFINITY;
		let earliestIso: string | null = null;

		for (const booking of bookings) {
			const startTime = new Date(booking?.booking?.startTime ?? '');
			const startMs = startTime.getTime();
			if (!Number.isNaN(startMs) && startMs < earliest) {
				earliest = startMs;
				earliestIso = booking.booking.startTime;
			}
		}

		return earliestIso;
	}

	function getUniqueClientIdsFromBookings(bookings: FullBooking[]): number[] {
		return Array.from(
			new Set(
				bookings
					.map((booking) => Number(booking?.client?.id))
					.filter((id) => Number.isInteger(id) && id > 0)
			)
		);
	}

	function toggleSelectAllLoaded(checked: boolean) {
		const loaded = get(bookings);
		if (loaded.length === 0) return;

		if (checked) {
			// add all loaded (dedupe by id)
			const current = get(selectedBookings);
			const byId = new Map(current.map((b) => [b.booking.id, b]));
			for (const item of loaded) byId.set(item.booking.id, item);
			selectedBookings.set(Array.from(byId.values()));
		} else {
			// remove only loaded ones
			const loadedIds = new Set(loaded.map((b) => b.booking.id));
			selectedBookings.update((cur) => cur.filter((b) => !loadedIds.has(b.booking.id)));
		}
	}

	// Reactive tri-state flags for the select-all checkbox

	$: {
		const all = $bookings;
		const selIds = new Set($selectedBookings.map((b) => b.booking.id));

		// checked when ALL loaded are selected (and there are some loaded)
		selectAllChecked = all.length > 0 && all.every((b) => selIds.has(b.booking.id));
	}

	$: cancelableSelected = $selectedBookings.filter((booking) => !isCancelledBooking(booking));
	$: cancelConfirmStartTimeISO =
		getEarliestStartTime(cancelableSelected) ?? new Date().toISOString();
	$: cancelConfirmOptions = cancelableSelected.length
		? {
				onConfirm: (reason: string, time: string, emailBehavior: CancelEmailBehavior) => {
					void cancelSelectedBookings({ reason, time, emailBehavior });
				},
				startTimeISO: cancelConfirmStartTimeISO,
				defaultEmailBehavior: 'none'
			}
		: null;
	// ✅ Fetch initial bookings when mounted
	onMount(() => {
		lastProfileScopeKey = profileScopeKey;
		hasMounted = true;
		loadMoreBookings(true);
	});

	$: if (hasMounted && profileScopeKey !== lastProfileScopeKey) {
		lastProfileScopeKey = profileScopeKey;
		clearAllSelected();
		loadMoreBookings(true);
	}

	// ✅ Fetch more bookings when scrolling
	async function loadMoreBookings(reset = false) {
		if (get(isLoading) || (!get(hasMore) && !reset)) return;

		if (!trainerId && normalizedClientIds.length === 0) {
			if (reset) {
				bookings.set([]);
				page.set(0);
			}
			hasMore.set(false);
			return;
		}

		const raw = get(selectedDate);

		if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
			// do nothing until the user finishes typing a valid date
			return;
		}

		const from = dayParam(raw);
		const to = null;

		const filters: any = {
			from,
			forwardOnly: true,
			sortAsc: true
		};

		if (trainerId) {
			filters.trainerIds = [trainerId];
		} else if (normalizedClientIds.length > 0) {
			filters.clientIds = normalizedClientIds;
		}

		if (reset) {
			bookings.set([]);
			page.set(0);
			hasMore.set(true);
		}

		const fetchCancelled = get(selectedCancelledOption).value;

		isLoading.set(true);
		try {
			const newBookings = await fetchBookings(
				filters,
				fetch,
				LIMIT,
				get(page) * LIMIT,
				fetchCancelled
			);

			if (newBookings.length < LIMIT) hasMore.set(false);
			bookings.update((prev) => [...prev, ...newBookings]);
			page.update((p) => p + 1);
		} catch (error) {
			console.error('Error fetching bookings:', error);
		} finally {
			isLoading.set(false);
		}
	}

	async function sendBookingConfirmations(
		behavior: 'send' | 'edit',
		recipientTarget: BookingEmailRecipientTarget = BOOKING_EMAIL_RECIPIENT_DEFAULT.value
	) {
		const bookingsToSend = get(selectedBookings);

		if (bookingsToSend.length === 0) return;

		const selectedClientIds = getUniqueClientIdsFromBookings(bookingsToSend);

		if (!clientId && selectedClientIds.length > 1) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Flera klienter valda',
				description: 'Du kan bara skicka bekräftelser till en klient åt gången.'
			});
			return;
		}

		const current = get(user);
		if (!current) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Saknar användare',
				description: 'Kunde inte skicka bekräftelsemail.'
			});
			return;
		}

		const resolvedClientId = clientId ?? selectedClientIds[0] ?? null;
		const trainerIds = Array.from(
			new Set(
				bookingsToSend
					.map((booking) => booking.trainer?.id)
					.filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
			)
		);

		const bookedDates = bookingsToSend.map((b) => {
			const start = new Date(b.booking.startTime);
			const time = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
			const date = start.toLocaleDateString('sv-SE');
			const locationName = b.location?.name || undefined;
			return { date, time, locationName };
		});

		let recipients = resolveBookingConfirmationRecipients({
			recipientTarget,
			clientId: resolvedClientId,
			trainerId: trainerIds
		});

		if (recipientTarget === 'both') {
			const needsClientEmails =
				typeof resolvedClientId === 'number' &&
				Number.isFinite(resolvedClientId) &&
				getClientEmails(resolvedClientId).length === 0;
			const needsTrainerEmails =
				trainerIds.length > 0 && getUserEmails(trainerIds).length < trainerIds.length;

			try {
				await Promise.all([
					needsClientEmails ? fetchClients() : Promise.resolve(),
					needsTrainerEmails ? fetchUsers() : Promise.resolve()
				]);
			} catch (error) {
				console.error('Failed to refresh recipients for booking email', error);
			}

			if (needsClientEmails || needsTrainerEmails || !recipients.length) {
				recipients = resolveBookingConfirmationRecipients({
					recipientTarget,
					clientId: resolvedClientId,
					trainerId: trainerIds
				});
			}
		}

		if (
			recipientTarget === 'both' &&
			client?.email &&
			(clientId == null || clientId === resolvedClientId) &&
			!recipients.some((email) => email.toLowerCase() === client.email.toLowerCase())
		) {
			recipients = [...recipients, client.email];
		}

		if (!recipients.length && recipientTarget === 'client') {
			recipients = await resolveClientRecipients(resolvedClientId);
		}

		if (!recipients.length) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Ingen e-postadress',
				description: 'Det saknas e-postadress för vald mottagare, så inget mail skickades.'
			});
			return;
		}

		let clientRecipientEmails =
			typeof resolvedClientId === 'number' && Number.isFinite(resolvedClientId)
				? getClientEmails(resolvedClientId)
				: [];
		if (!clientRecipientEmails.length && client?.email) {
			clientRecipientEmails = [client.email];
		}

		const emailResult = await handleBookingEmail({
			emailBehavior: behavior,
			recipientEmails: recipients,
			fromUser: current,
			bookedDates,
			clientId: resolvedClientId,
			clientRecipientEmails
		});

		if (emailResult !== 'edit') {
			return;
		}

		let calendarLinks: ClientCalendarEmailLinks | null = null;
		try {
			calendarLinks =
				recipientTarget === 'client'
					? await requireClientCalendarEmailLinks(resolvedClientId)
					: null;
		} catch (error) {
			console.error('Failed to create calendar links for booking email editor', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte skapa kalenderlänkar',
				description:
					error instanceof Error
						? error.message
						: 'Kunde inte skapa länkarna till kundens bokningar och kalender.'
			});
			return;
		}

		const body = buildBookingConfirmationEmailBody({
			bookedDates,
			fromUser: current,
			calendarSyncUrl: calendarLinks?.syncPageUrl ?? null,
			bookingsPageUrl: calendarLinks?.bookingsPageUrl ?? null
		});

		openPopup({
			header: `Maila bokningsbekräftelse till ${recipients.join(', ')}`,
			icon: 'Mail',
			component: MailComponent,
			maxWidth: '900px',
			props: {
				prefilledRecipients: recipients,
				subject: 'Bokningsbekräftelse',
				header: 'Bekräftelse på dina bokningar',
				subheader: 'Tack för din bokning!',
				body,
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			}
		});
	}

	async function resolveClientRecipients(targetClientId = clientId) {
		if (!targetClientId) return [];
		let emails = getClientEmails(targetClientId);

		if (!emails.length) {
			try {
				await fetchClients();
				emails = getClientEmails(targetClientId);
			} catch (error) {
				console.error('Failed to fetch clients for cancellation email', error);
			}
		}

		if (!emails.length && client?.email) {
			emails = [client.email];
		}

		return emails;
	}

	function buildCancellationBody(
		bookedDates: BookedDate[],
		fromUser: { firstname?: string | null }
	) {
		const lines = bookedDates
			.map((b) => `${b.date} kl. ${b.time}${b.locationName ? ` på ${b.locationName}` : ''}`)
			.join('<br>');

		return [
			'Hej!',
			'',
			'Följande bokningar har avbokats:',
			lines,
			'',
			'Hälsningar,',
			`${fromUser.firstname}, Takkei Trainingsystems`
		].join('<br>');
	}

	async function handleCancellationEmail(behavior: CancelEmailBehavior, bookings: FullBooking[]) {
		if (behavior === 'none') return;
		const current = get(user);

		if (!current) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Saknar användare',
				description: 'Kunde inte skicka avbokningsbekräftelse.'
			});
			return;
		}

		const selectedClientIds = getUniqueClientIdsFromBookings(bookings);
		if (!clientId && selectedClientIds.length > 1) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Flera klienter valda',
				description: 'Du kan bara skicka avbokningsbekräftelser till en klient åt gången.'
			});
			return;
		}

		const resolvedClientId = clientId ?? selectedClientIds[0] ?? null;
		const recipients = await resolveClientRecipients(resolvedClientId);
		if (!recipients.length) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Ingen e-postadress',
				description: 'Kunden saknar e-postadress, så inget mail skickades.'
			});
			return;
		}

		const bookedDates = bookings.map((b) => {
			const start = new Date(b.booking.startTime);
			const time = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
			const date = start.toLocaleDateString('sv-SE');
			const locationName = b.location?.name || undefined;
			return { date, time, locationName };
		});

		const body = buildCancellationBody(bookedDates, current);
		const mailConfig = {
			to: recipients,
			subject: 'Avbokningsbekräftelse',
			header: 'Dina bokningar har avbokats',
			subheader: 'Vi har noterat din avbokning',
			body,
			from: {
				name: `${current.firstname} ${current.lastname}`,
				email: current.email
			}
		};

		if (behavior === 'send') {
			try {
				await sendMail(mailConfig);
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Bekräftelsemail skickat',
					description: `Ett bekräftelsemail skickades till ${recipients.join(', ')}.`
				});
			} catch (error) {
				console.error('Failed to send cancellation email', error);
				addToast({
					type: AppToastType.CANCEL,
					message: 'Mail kunde inte skickas',
					description: 'Avbokningsbekräftelsen kunde inte skickas automatiskt.'
				});
			}
			return;
		}

		if (behavior === 'edit') {
			openPopup({
				header: `Maila avbokningsbekräftelse till ${recipients.join(', ')}`,
				icon: 'Mail',
				component: MailComponent,
				maxWidth: '900px',
				props: {
					prefilledRecipients: recipients,
					subject: mailConfig.subject,
					header: mailConfig.header,
					subheader: mailConfig.subheader,
					body,
					lockedFields: ['recipients'],
					autoFetchUsersAndClients: false
				}
			});
		}
	}

	async function cancelSelectedBookings({
		reason,
		time,
		emailBehavior = 'none'
	}: {
		reason?: string;
		time?: string;
		emailBehavior?: 'send' | 'edit' | 'none';
	}) {
		const selected = get(selectedBookings);
		const cancelable = selected.filter((booking) => !isCancelledBooking(booking));
		const skipped = selected.length - cancelable.length;

		if (!cancelable.length) {
			addToast({
				type: AppToastType.NOTE,
				message: 'Inga bokningar att avboka',
				description: 'Alla valda bokningar är redan avbokade.'
			});
			return;
		}

		if (!reason) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Orsak saknas',
				description: 'Vänligen välj en avbokningsorsak.'
			});
			return;
		}

		const cancelTime = time ?? new Date().toISOString().slice(0, 16);
		const results = await Promise.all(
			cancelable.map((booking) => cancelBooking(booking.booking.id, reason, cancelTime))
		);

		const successful: FullBooking[] = [];
		const failed: FullBooking[] = [];

		results.forEach((result, index) => {
			if (result.success) {
				successful.push(cancelable[index]);
			} else {
				failed.push(cancelable[index]);
			}
		});

		if (successful.length) {
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Bokningar avbokade',
				description: `${successful.length} av ${cancelable.length} bokningar avbokades.`
			});
			await handleCancellationEmail(emailBehavior, successful);
			loadMoreBookings(true);
		}

		if (failed.length) {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Avbokning misslyckades',
				description: `${failed.length} bokningar kunde inte avbokas.`
			});
		}

		if (skipped > 0) {
			addToast({
				type: AppToastType.NOTE,
				message: 'Bokningar redan avbokade',
				description: `${skipped} valda bokningar var redan avbokade.`
			});
		}

		clearAllSelected();
	}

	// ✅ Handle Infinite Scroll
	function handleScroll(event: Event) {
		const target = event.currentTarget as HTMLElement;
		const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
		if (bottom && get(hasMore) && !get(isLoading)) {
			loadMoreBookings();
		}
	}

	// ✅ Update selected date & re-fetch
	function updateStartDate(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const val = target.value;
		selectedDate.set(val);

		debouncedLoad(val);
	}

	// ✅ Toggle Canceled Bookings
	function handleCancelledSelection(event: CustomEvent<boolean>) {
		selectedCancelledOption.set(
			event.detail
				? { value: true, label: 'Visa avbokade' }
				: { value: false, label: 'Visa inte avbokade' }
		);
		loadMoreBookings(true);
	}

	function handleBookingClick(event: CustomEvent<FullBooking>) {
		openPopup({
			header: 'Bokningsdetaljer',
			icon: 'CircleInfo',
			component: BookingDetailsPopup as unknown as ComponentType,
			props: { booking: event.detail },
			maxWidth: '650px',
			height: '850px',
			listeners: {
				updated: () => {
					loadMoreBookings(true);
				}
			}
		});
	}
</script>

<!-- 🔹 Filters -->
<div class="wrapper">
	<div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
		<!-- ✅ Start Date Filter -->
		<div>
			<label class="text-gray text-sm font-medium">Från datum</label>
			<input
				type="date"
				value={$selectedDate}
				on:change={updateStartDate}
				class="text-gray h-9 w-full rounded-sm border p-2"
			/>
		</div>

		<!-- ✅ Toggle Canceled Bookings -->
		<div class="mt-6">
			<OptionButton
				options={[
					{ value: false, label: 'Visa inte avbokade' },
					{ value: true, label: 'Visa avbokade' }
				]}
				bind:selectedOption={$selectedCancelledOption}
				size="small"
				on:select={handleCancelledSelection}
				full
			/>
		</div>
	</div>

	{#if showBookingActions}
		<div
			class="bg-orange/10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-sm px-4 py-3 shadow-xs"
		>
			<div class="flex items-center gap-3">
				<!-- ✅ Select-all (loaded) using your Checkbox component -->
				<Checkbox
					id="select-all-loaded"
					name="select-all-loaded"
					label="Välj alla visade"
					checked={selectAllChecked}
					on:change={(e) => toggleSelectAllLoaded(e.detail.checked)}
				/>

				<span class="text-sm text-gray-700">
					{$selectedBookings.length > 0
						? `${$selectedBookings.length} bokningar valda`
						: 'Inga bokningar valda'}
				</span>
			</div>

			<div class="flex items-center gap-2">
				<Button
					variant="secondary"
					icon="Uncheck"
					small
					on:click={clearAllSelected}
					disabled={$selectedBookings.length === 0}
				/>

				<Button
					disabled={$selectedBookings.length === 0}
					text="Skicka bekräftelse"
					iconLeft="Mail"
					variant="primary"
					small
					class="bg-orange! text-white disabled:cursor-not-allowed disabled:opacity-50"
					multipleActionsOptions={{
						title: 'Skicka bekräftelse?',
						description: 'Välj hur bekräftelsen ska skickas.',
						selectionLabel: 'Mottagare',
						selectionOptions: BOOKING_EMAIL_RECIPIENT_OPTIONS.map((option) => ({
							label: option.label,
							value: option.value
						})),
						defaultSelection: BOOKING_EMAIL_RECIPIENT_DEFAULT.value,
						primaryLabel: 'Skicka direkt',
						primaryAction: (recipientTarget) => {
							void sendBookingConfirmations(
								'send',
								(recipientTarget as BookingEmailRecipientTarget | undefined) ??
									BOOKING_EMAIL_RECIPIENT_DEFAULT.value
							);
						},
						secondaryLabel: 'Redigera innan',
						secondaryAction: (recipientTarget) => {
							void sendBookingConfirmations(
								'edit',
								(recipientTarget as BookingEmailRecipientTarget | undefined) ??
									BOOKING_EMAIL_RECIPIENT_DEFAULT.value
							);
						}
					}}
				/>

				<Button
					disabled={cancelableSelected.length === 0}
					text="Avboka valda"
					iconLeft="Trash"
					iconColor="error"
					variant="danger-outline"
					small
					{cancelConfirmOptions}
				/>
			</div>
		</div>
	{/if}

	<!-- 🔹 Booking List (Infinite Scroll) -->
	<div
		class="custom-scrollbar h-full max-h-[65vh] space-y-3 overflow-y-scroll pt-4"
		on:scroll={handleScroll}
	>
		{#each $bookings as booking (booking.booking.id)}
			<ProfileBookingSlot
				{booking}
				{isClient}
				showSelect={showBookingActions}
				selected={$selectedBookings.some((b) => b.booking.id === booking.booking.id)}
				onSelect={(checked, selectedBooking) => {
					selectedBookings.update((current) => {
						if (checked) {
							return [...current, selectedBooking];
						} else {
							return current.filter((b) => b.booking.id !== selectedBooking.booking.id);
						}
					});
				}}
				on:bookingClick={handleBookingClick}
			/>
		{/each}

		{#if $isLoading}
			<p class="text-gray-bright mt-4 text-center">Laddar fler bokningar...</p>
		{/if}

		{#if !$isLoading && $bookings.length === 0}
			<p class="text-gray-bright mt-4 text-center">Inga bokningar hittades.</p>
		{/if}

		{#if !$hasMore && $bookings.length > 0}
			<p class="text-gray-bright mt-4 text-center">Inga fler bokningar att visa.</p>
		{/if}
	</div>
</div>

<style>
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: #cbd5e1 transparent;
	}
</style>
