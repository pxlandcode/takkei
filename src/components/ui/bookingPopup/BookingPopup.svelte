<script lang="ts">
	import { onMount } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import { clients, fetchClients } from '$lib/stores/clientsStore';
	import { bookingContents, fetchBookingContents } from '$lib/stores/bookingContentStore';
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
	import Button from '../../bits/button/Button.svelte';
	import BookingTraining from './bookingTraining/BookingTraining.svelte';
	import BookingMeeting from './bookingMeeting/BookingMeeting.svelte';
	import { user } from '$lib/stores/userStore';
	import { createBooking } from '$lib/services/api/bookingService';
	import BookingPersonal from './bookingPersonal/BookingPersonal.svelte';
	import OptionsSelect from '../../bits/options-select/OptionsSelect.svelte';
	import { get } from 'svelte/store';
	import { addNotification } from '$lib/stores/notificationStore';
	import { AppNotificationType } from '$lib/types/notificationTypes';

	// Store selected booking type component
	let selectedBookingComponent: 'training' | 'meeting' = 'training';

	let bookingObject = {
		user_id: null,
		booked_by_id: null,
		bookingType: null, // training or meeting
		trainerId: null,
		clientId: null,
		attendees: [],
		locationId: null,
		date: new Date().toISOString().split('T')[0],
		time: '12:30',
		endTime: '13:30',
		repeat: false
	};

	// Fetch all required data
	onMount(async () => {
		const currentUser = get(user); // Get user store value
		if (currentUser) {
			bookingObject.user_id = currentUser.id;
			bookingObject.booked_by_id = currentUser.id;
		}

		await Promise.all([fetchUsers(), fetchLocations(), fetchClients(), fetchBookingContents()]);

		console.log('locations', get(locations));
	});
	// API call to create booking
	async function submitBooking() {
		const type = selectedBookingComponent;
		const result = await createBooking(bookingObject, type);

		if (result.success) {
			addNotification({
				type: AppNotificationType.SUCCESS,
				message: 'Bokning genomförd',
				description: `Bokningen skapades klockan ${bookingObject.time} den ${bookingObject.date}.`
			});
		} else {
			addNotification({
				type: AppNotificationType.CANCEL,
				message: 'Något gick fel',
				description: `Något gick fel, försök igen eller kontakta IT.`
			});
		}
	}
</script>

<!-- Booking Manager UI -->
<div class="flex w-[600px] flex-col gap-4 bg-white">
	<!-- Booking Type Selector -->

	<!-- Booking Type Selector -->
	<OptionsSelect
		bind:selectedValue={selectedBookingComponent}
		options={[
			{ label: 'Träning', icon: 'Training', value: 'training' },
			{ label: 'Möte', icon: 'Meeting', value: 'meeting' },
			{ label: 'Personlig', icon: 'Person', value: 'personal' }
		]}
	/>

	<!-- Dynamic Booking Component -->
	{#if selectedBookingComponent === 'training'}
		<BookingTraining
			bind:bookingObject
			bookingContents={($bookingContents || []).map((content) => ({
				value: content.id,
				label: capitalizeFirstLetter(content.kind)
			}))}
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
		<BookingPersonal
			bind:bookingObject
			locations={($locations || []).map((location) => ({
				label: location.name,
				value: location.id
			}))}
		/>
	{/if}

	<!-- Shared Booking Button -->
	<Button
		full
		variant="primary"
		text="Slutför Bokning"
		iconLeft="Check"
		iconLeftSize="14px"
		on:click={submitBooking}
	/>
</div>
