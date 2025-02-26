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

	// Store selected booking type component
	let selectedBookingComponent: 'training' | 'meeting' = 'training';

	// Shared booking object that updates dynamically
	let bookingObject = {
		bookingType: null, // training or meeting
		trainerId: null,
		clientId: null,
		attendees: [],
		locationId: null,
		date: new Date().toISOString().split('T')[0],
		time: '12:30',
		repeat: false
	};

	// Fetch all required data
	onMount(async () => {
		await Promise.all([fetchUsers(), fetchLocations(), fetchClients(), fetchBookingContents()]);
	});

	// API call to create booking
	async function submitBooking() {
		const result = await createBooking(bookingObject);
		console.log('Booking Response:', result);
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
			users={($users || []).map((user) => ({
				label: `${user.firstname} ${user.lastname}`,
				value: user.id
			}))}
			clients={($clients || []).map((client) => ({
				label: `${client.firstname} ${client.lastname}`,
				value: client.id
			}))}
			locations={($locations || []).map((location) => ({
				label: location.name,
				value: location.id
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
