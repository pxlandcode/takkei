<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import { clients, fetchClients, getClientEmails } from '$lib/stores/clientsStore';
	import { bookingContents, fetchBookingContents } from '$lib/stores/bookingContentStore';
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
	import Button from '../../bits/button/Button.svelte';
	import BookingTraining from './bookingTraining/BookingTraining.svelte';
	import BookingMeeting from './bookingMeeting/BookingMeeting.svelte';
	import OptionsSelect from '../../bits/options-select/OptionsSelect.svelte';
	import { user } from '$lib/stores/userStore';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { get } from 'svelte/store';
	import {
		handleMeetingOrPersonalBooking,
		handleTrainingBooking
	} from '$lib/helpers/bookingHelpers/bookingHelpers';
	import { popupStore } from '$lib/stores/popupStore';
	import { handleBookingEmail } from '$lib/helpers/bookingHelpers/bookingHelpers';

	export let startTime: Date | null = null;
	export let clientId: number | null = null;
	export let trainerId: number | null = null;

	const dispatch = createEventDispatcher();

	function onClose() {
		calendarStore.refresh(fetch);
		dispatch('close');
	}

	let selectedBookingComponent: 'training' | 'meeting' | 'personal' | 'trial' = 'training';
	let repeatedBookings = [];
	let selectedIsUnavailable = false;
	let currentUser = get(user);

	let bookingObject = {
		user_id: null,
		booked_by_id: null,
		user_ids: [],
		attendees: [],
		bookingType: null,
		trainerId: null,
		clientId: null,
		locationId: null,
		currentUser: null,
		isTrial: false,
		name: '',
		text: '',
		date: startTime
			? startTime.toISOString().split('T')[0]
			: new Date().toISOString().split('T')[0],
		time: startTime
			? startTime.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', hour12: false })
			: '12:30',
		endTime: startTime
			? new Date(startTime.getTime() + 60 * 60 * 1000).toLocaleTimeString('sv-SE', {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false
				})
			: '13:30',
		repeat: false,
		emailBehavior: { label: 'Skicka inte', value: 'none' }
	};

	// Reactive booking type fallback
	$: {
		if (selectedBookingComponent === 'personal') {
			bookingObject.bookingType = { label: 'Privat', value: 'Private' };
			bookingObject.isTrial = false;
		} else if (selectedBookingComponent === 'meeting') {
			bookingObject.bookingType = { label: 'Möte', value: 'Meeting' };
			bookingObject.isTrial = false;
		} else if (selectedBookingComponent === 'trial') {
			bookingObject.bookingType = null;
			bookingObject.isTrial = true;
		} else if (selectedBookingComponent === 'training') {
			bookingObject.bookingType = null;
			bookingObject.isTrial = false;
		}
	}

	// Sync user_ids and user_id from attendees

	// Load initial data
	onMount(async () => {
		currentUser = get(user);
		if (currentUser) {
			bookingObject.user_id = currentUser.id;
			bookingObject.booked_by_id = currentUser.id;
		}

		await Promise.all([fetchUsers(), fetchLocations(), fetchClients(), fetchBookingContents()]);

		if (clientId) {
			bookingObject.clientId = clientId;
		} else {
			// fallback: show all clients (or none)
			bookingObject.clientId = null;
		}

		if (trainerId) {
			bookingObject.trainerId = trainerId;
		}

		if (startTime) {
			const currentFilters = get(calendarStore).filters;

			if (currentFilters.trainerIds?.length === 1) {
				bookingObject.trainerId = currentFilters.trainerIds[0];
			}

			if (currentFilters.locationIds?.length === 1) {
				bookingObject.locationId = currentFilters.locationIds[0];
			}

			if (currentFilters.clientIds?.length === 1) {
				bookingObject.clientId = currentFilters.clientIds[0];
			}
		}
	});

	function getLocationLabelFromId(id: number | null | undefined) {
		const list = $locations || [];
		const loc = id ? list.find((l) => l.id === id) : null;
		// Prefer street address (e.g., "Garvargatan 7"), then name, else fallback.
		return (loc?.address && loc.address.trim()) || loc?.name || 'Okänd plats';
	}

	async function submitBooking() {
		const type = selectedBookingComponent;
		bookingObject.currentUser = currentUser;
		if (!currentUser) return;

		const locationName = getLocationLabelFromId(bookingObject.locationId);

		let bookedDates: { date: string; time: string; locationName?: string }[] = [];
		let success = false;

		if (type === 'training' || type === 'trial') {
			const result = await handleTrainingBooking(
				bookingObject,
				currentUser,
				repeatedBookings,
				'training'
			);
			success = result.success;

			if (success) {
				if (repeatedBookings.length > 0) {
					bookedDates = repeatedBookings.map((r) => ({
						date: r.date,
						time: r.selectedTime,
						locationName
					}));
				} else {
					bookedDates = [{ date: bookingObject.date, time: bookingObject.time, locationName }];
				}
			}
		} else {
			// meeting | personal
			const res = await handleMeetingOrPersonalBooking(bookingObject, currentUser, type);
			success = res.success;

			if (success) {
				bookedDates = [{ date: bookingObject.date, time: bookingObject.time }];
			}
		}

		if (success && bookingObject.clientId) {
			const clientEmail = getClientEmails(bookingObject.clientId);

			if (clientEmail) {
				const emailResult = await handleBookingEmail({
					emailBehavior: bookingObject.emailBehavior.value,
					clientEmail,
					fromUser: currentUser,
					bookedDates
				});

				if (emailResult === 'edit') {
					popupStore.set({
						type: 'mail',
						header: `Maila bokningsbekräftelse till ${clientEmail}`,
						data: {
							prefilledRecipients: clientEmail,
							subject: 'Bokningsbekräftelse',
							header: 'Bekräftelse på dina bokningar',
							subheader: 'Tack för din bokning!',
							body: `
							Hej!<br><br>
							Jag har bokat in dig följande tider:<br>
							${bookedDates.map((b) => `${b.date} kl. ${b.time} på ${b.locationName}`).join('<br>')}<br><br>
							Du kan boka av eller om din träningstid senast klockan 12.00 dagen innan träning genom att kontakta någon i ditt tränarteam via sms, e‑post eller telefon.<br><br>
							Hälsningar,<br>
							${currentUser.firstname}<br>
							Takkei Trainingsystems
						`,
							lockedFields: ['recipients'],
							autoFetchUsersAndClients: false
						}
					});
				}
			}
		}

		if (success) {
			onClose();
		}
	}
</script>

<!-- Booking Manager UI -->
<div class="flex w-full max-w-[600px] flex-col gap-4 bg-white md:w-[600px]">
	<!-- Booking Type Selector -->

	<!-- Booking Type Selector -->
	<OptionsSelect
		bind:selectedValue={selectedBookingComponent}
		options={[
			{ label: 'Träning', icon: 'Training', value: 'training' },
			{ label: 'Provträning', icon: 'ShiningStar', value: 'trial' },
			{ label: 'Möte', icon: 'Meeting', value: 'meeting' },
			{ label: 'Personlig', icon: 'Person', value: 'personal' }
		]}
	/>
	<!-- Dynamic Booking Component -->
	{#if selectedBookingComponent === 'training' || selectedBookingComponent === 'trial'}
		<BookingTraining
			bind:bookingObject
			bind:repeatedBookings
			bookingContents={($bookingContents || []).map((content) => ({
				value: content.id,
				label: capitalizeFirstLetter(content.kind)
			}))}
			isTrial={bookingObject.isTrial}
		/>
	{:else if selectedBookingComponent === 'meeting'}
		<BookingMeeting
			bind:bookingObject
			users={($users || []).map((user) => ({
				name: `${user.firstname} ${user.lastname}`,
				value: user.id
			}))}
			locations={($locations || []).map((location) => ({
				label: location.name,
				value: location.id
			}))}
		/>
	{:else if selectedBookingComponent === 'personal'}
		<BookingMeeting bind:bookingObject isMeeting={false} />
	{/if}

	<!-- Shared Booking Button -->
	{#if selectedIsUnavailable}
		<Button
			full
			variant="primary"
			text="Slutför Bokning"
			iconLeft="CalendarCheck"
			iconLeftSize="18px"
			disabled={repeatedBookings.length > 0 && repeatedBookings.some((b) => b.conflict)}
			confirmOptions={{
				title: 'Är du säker?',
				description:
					'Den valda tiden ligger utanför den valda tränarens schema. Är du säker på att du vill slutföra bokningen ändå?',
				action: submitBooking
			}}
		/>
	{:else}
		<Button
			full
			variant="primary"
			text="Slutför Bokning"
			iconLeft="CalendarCheck"
			iconLeftSize="18px"
			on:click={submitBooking}
			disabled={repeatedBookings.length > 0 && repeatedBookings.some((b) => b.conflict)}
		/>{/if}
</div>
