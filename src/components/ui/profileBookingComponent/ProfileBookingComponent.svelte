<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchBookings } from '$lib/services/api/calendarService';
	import { writable, get } from 'svelte/store';

	import ProfileBookingSlot from '../profileBookingSlot/ProfileBookingSlot.svelte';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import PopupWrapper from '../popupWrapper/PopupWrapper.svelte';
	import BookingDetailsPopup from '../bookingDetailsPopup/BookingDetailsPopup.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { popupStore } from '$lib/stores/popupStore';
	import { user } from '$lib/stores/userStore';
	import { debounce } from '$lib/utils/debounce';

	export let trainerId: number | null = null;
	export let clientId: number | null = null;
	export let client: any = null;
	// ✅ Reactive Stores
	let bookings = writable([]);
	let page = writable(0);
	let isLoading = writable(false);
	let hasMore = writable(true);

	let selectedBooking = null;
	let showBookingDetailsPopup = false;
	let selectedBookings = writable([]);

	let currentUser = get(user);

	const debouncedLoad = debounce((val) => {
		if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
			loadMoreBookings(true);
		}
	}, 300);

	const isClient = clientId !== null;

	// ✅ Filters
	const today = new Date();
	const oneMonthBack = new Date(today);
	oneMonthBack.setMonth(today.getMonth() - 1);

	let selectedDate = writable(
		clientId ? oneMonthBack.toISOString().split('T')[0] : today.toISOString().split('T')[0]
	); // Default to today
	let selectedCancelledOption = writable({ value: false, label: 'Visa inte avbokade' });

	const LIMIT = 20;

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

		const from = raw;
		d;
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

		popupStore.set({
			type: 'mail',
			header: `Maila bokningsbekräftelse till ${clientEmail}`,
			data: {
				prefilledRecipients: [clientEmail],
				subject: 'Bokningsbekräftelse',
				header: 'Bekräftelse på dina bokningar',
				subheader: 'Tack för din bokning!',
				body: body,
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			}
		});
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
		selectedBooking = event.detail;
		showBookingDetailsPopup = true;
	}
</script>

<!-- 🔹 Filters -->
<div class="wrapper">
	<div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
		<!-- ✅ Start Date Filter -->
		<div>
			<label class="text-sm font-medium text-gray">Från datum</label>
			<input
				type="date"
				value={$selectedDate}
				on:change={updateStartDate}
				class="h-9 w-full rounded-lg border p-2 text-gray"
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
		<div class="mt-4 flex items-center justify-between rounded-lg bg-orange/10 px-4 py-3 shadow-sm">
			<p class="text-sm text-gray-700">
				{$selectedBookings.length > 0
					? `${$selectedBookings.length} bokningar valda`
					: 'Inga bokningar valda'}
			</p>

			<Button
				disabled={$selectedBookings.length === 0}
				text="Skicka bekräftelse"
				iconLeft="Mail"
				variant="primary"
				small
				class="!bg-orange text-white disabled:cursor-not-allowed disabled:opacity-50"
				on:click={() => {
					sendBookingConfirmations();
				}}
			/>
		</div>
	{/if}

	<!-- 🔹 Booking List (Infinite Scroll) -->
	<div
		class="h-full max-h-[65vh] space-y-3 overflow-y-scroll pt-4 custom-scrollbar"
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
			<p class="mt-4 text-center text-gray-bright">Laddar fler bokningar...</p>
		{/if}

		{#if !$hasMore && $bookings.length > 0}
			<p class="mt-4 text-center text-gray-bright">Inga fler bokningar att visa.</p>
		{/if}
	</div>
</div>

{#if showBookingDetailsPopup && selectedBooking}
	<PopupWrapper
		header="Bokningsdetaljer"
		icon="CircleInfo"
		on:close={() => {
			showBookingDetailsPopup = false;
			selectedBooking = null;
		}}
	>
		<BookingDetailsPopup
			booking={selectedBooking}
			on:close={() => {
				showBookingDetailsPopup = false;
				selectedBooking = null;
			}}
		/>
	</PopupWrapper>
{/if}

<style>
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: #cbd5e1 transparent;
	}
</style>
