<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchBookings } from '$lib/services/api/calendarService';
	import { writable, get } from 'svelte/store';
	import { cancelBooking } from '$lib/services/api/bookingService';
	import { fetchClients, getClientEmails } from '$lib/stores/clientsStore';
	import { sendMail } from '$lib/services/mail/mailClientService';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	import ProfileBookingSlot from '../profileBookingSlot/ProfileBookingSlot.svelte';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { openPopup } from '$lib/stores/popupStore';
	import { user } from '$lib/stores/userStore';
	import { debounce } from '$lib/utils/debounce';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import BookingDetailsPopup from '../bookingDetailsPopup/BookingDetailsPopup.svelte';
	import MailComponent from '../mailComponent/MailComponent.svelte';

	export let trainerId: number | null = null;
	export let clientId: number | null = null;
	export let client: any = null;
	// ✅ Reactive Stores
	let bookings = writable([]);
	let page = writable(0);
	let isLoading = writable(false);
	let hasMore = writable(true);
	let selectAllChecked = false;

	let selectedBookings = writable([]);
	let cancelableSelected = [];
	let cancelConfirmStartTimeISO = new Date().toISOString();
	let cancelConfirmOptions = null;

	const CANCELLED_STATUSES = new Set(['cancelled', 'late_cancelled']);

	let currentUser = get(user);

	const debouncedLoad = debounce((val) => {
		if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
			loadMoreBookings(true);
		}
	}, 300);

	const isClient = clientId !== null;

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

	let selectedDate = writable(clientId ? ymdNoon(oneMonthBack) : ymdNoon(today));
	let selectedCancelledOption = writable({ value: false, label: 'Visa inte avbokade' });

	const LIMIT = 20;

	function allLoadedSelected() {
		const all = get(bookings);
		const selIds = new Set(get(selectedBookings).map((b) => b.booking.id));
		return all.length > 0 && all.every((b) => selIds.has(b.booking.id));
	}

	function clearAllSelected() {
		selectedBookings.set([]);
	}

	function isCancelledBooking(booking) {
		const status = String(booking?.booking?.status ?? '').toLowerCase();
		return CANCELLED_STATUSES.has(status) || Boolean(booking?.booking?.cancelTime);
	}

	function getEarliestStartTime(bookings) {
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
				onConfirm: (reason: string, time: string, emailBehavior: 'send' | 'edit' | 'none') => {
					void cancelSelectedBookings({ reason, time, emailBehavior });
				},
				startTimeISO: cancelConfirmStartTimeISO,
				defaultEmailBehavior: 'none'
			}
		: null;
	// ✅ Fetch initial bookings when mounted
	onMount(() => {
		loadMoreBookings(true);
	});

	// ✅ Fetch more bookings when scrolling
	async function loadMoreBookings(reset = false) {
		if (get(isLoading) || (!get(hasMore) && !reset)) return;

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
		} else if (clientId) {
			filters.clientIds = [clientId];
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

	function sendBookingConfirmations() {
		const bookingsToSend = get(selectedBookings);

		if (bookingsToSend.length === 0) return;

		// If more than one unique client is selected, show a warning or handle differently
		const uniqueClients = Array.from(
			new Set(bookingsToSend.map((b) => b.client?.email).filter(Boolean))
		);

		if (uniqueClients.length > 1) {
			alert('You can only send confirmations to one client at a time.');
			return;
		}

		const clientEmail = client?.email;

		const bookedDates = bookingsToSend.map((b) => {
			console.log(b);
			const start = new Date(b.booking.startTime);
			const time = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
			const date = start.toLocaleDateString('sv-SE');
			const locationName = b.location?.name || undefined;
			return { date, time, locationName };
		});

		const linesHtml = bookedDates
			.map((bd) =>
				bd.locationName
					? `${bd.date} kl. ${bd.time} på ${bd.locationName}`
					: `${bd.date} kl. ${bd.time}`
			)
			.join('<br>');

		const body = [
			'Hej!',
			'',
			'<b>Jag har bokat in dig följande tider:</b>',
			linesHtml,
			'Du kan boka av eller om din träningstid senast klockan 12.00 dagen innan träning genom att kontakta någon i ditt tränarteam via sms, e-post eller telefon.',
			'',
			'Hälsningar,',
			`${currentUser.firstname}, Takkei Trainingsystems`
		].join('<br>');

		openPopup({
			header: `Maila bokningsbekräftelse till ${clientEmail}`,
			icon: 'Mail',
			component: MailComponent,
			maxWidth: '900px',
			props: {
				prefilledRecipients: [clientEmail],
				subject: 'Bokningsbekräftelse',
				header: 'Bekräftelse på dina bokningar',
				subheader: 'Tack för din bokning!',
				body,
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			}
		});
	}

	async function resolveClientRecipients() {
		if (!clientId) return [];
		let emails = client?.email ? [client.email] : getClientEmails(clientId);

		if (!emails.length) {
			try {
				await fetchClients();
				emails = getClientEmails(clientId);
			} catch (error) {
				console.error('Failed to fetch clients for cancellation email', error);
			}
		}

		return emails;
	}

	function buildCancellationBody(bookedDates, fromUser) {
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

	async function handleCancellationEmail(behavior, bookings) {
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

		const recipients = await resolveClientRecipients();
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

		const successful = [];
		const failed = [];

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
	function handleScroll(event) {
		const bottom =
			event.target.scrollHeight - event.target.scrollTop <= event.target.clientHeight + 50;
		if (bottom && get(hasMore) && !get(isLoading)) {
			loadMoreBookings();
		}
	}

	// ✅ Update selected date & re-fetch
	function updateStartDate(event) {
		const val = event.target.value;
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

	function handleBookingClick(event) {
		openPopup({
			header: 'Bokningsdetaljer',
			icon: 'CircleInfo',
			component: BookingDetailsPopup,
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

	{#if clientId}
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
					on:click={sendBookingConfirmations}
				/>

				<Button
					disabled={cancelableSelected.length === 0}
					text="Avboka valda"
					iconLeft="Trash"
					iconColor="error"
					variant="danger-outline"
					small
					cancelConfirmOptions={cancelConfirmOptions}
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
				showSelect={clientId !== null}
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
