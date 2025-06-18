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
	import BookingPersonal from './bookingPersonal/BookingPersonal.svelte';
	import OptionsSelect from '../../bits/options-select/OptionsSelect.svelte';
	import { user } from '$lib/stores/userStore';
	import { createBooking } from '$lib/services/api/bookingService';
	import { sendMail } from '$lib/services/mail/mailClientService';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { get } from 'svelte/store';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	export let startTime: Date | null = null;

	const dispatch = createEventDispatcher();

	function onClose() {
		calendarStore.refresh(fetch);
		dispatch('close');
	}

	let selectedBookingComponent: 'training' | 'meeting' | 'personal' = 'training';
	let repeatedBookings = [];
	let selectedIsUnavailable = false;
	let currentUser = get(user);

	let bookingObject = {
		user_id: null,
		booked_by_id: null,
		user_ids: [],
		attendees: [],
		bookingType: null, // used for training: { label, value }, meeting/personal: { label, value } like 'Private'
		trainerId: null,
		clientId: null,
		locationId: null,
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
		repeat: false
	};

	// Reactive booking type fallback
	$: {
		if (selectedBookingComponent === 'personal') {
			bookingObject.bookingType = { label: 'Privat', value: 'Private' };
		} else if (selectedBookingComponent === 'meeting') {
			bookingObject.bookingType = { label: 'Möte', value: 'Meeting' };
		} else if (selectedBookingComponent === 'training') {
			bookingObject.bookingType = null;
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

	async function submitBooking() {
		const type = selectedBookingComponent;
		let bookedDates = [];
		bookingObject.currentUser = currentUser;

		if (repeatedBookings.length > 0) {
			let successCount = 0;

			for (let i = 0; i < repeatedBookings.length; i++) {
				const repeated = repeatedBookings[i];
				const singleBooking = {
					...bookingObject,
					date: repeated.date,
					time: repeated.selectedTime
				};

				const result = await createBooking(singleBooking, type);

				if (result.success) {
					successCount++;
					bookedDates.push(`${repeated.date} kl ${repeated.selectedTime}`);
				} else {
					addToast({
						type: AppToastType.CANCEL,
						message: `Fel vid bokning ${i + 1}`,
						description: `Misslyckades: ${singleBooking.date} kl ${singleBooking.time}.`
					});
				}
			}

			if (successCount === repeatedBookings.length) {
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Alla bokningar klara!',
					description: `${successCount} av ${repeatedBookings.length} lyckades.`
				});

				if (type === 'training' && bookingObject.clientId) {
					const clientEmail = getClientEmails(bookingObject.clientId);
					if (clientEmail) {
						const result = await sendMail({
							to: clientEmail,
							subject: 'Bokningsbekräftelse',
							header: 'Bekräftelse på dina bokningar',
							subheader: 'Tack för din bokning!',
							body: `
								Hej! Här är dina bekräftade bokningar:<br><br>
								${bookedDates.map((d) => `• ${d}`).join('<br>')}<br><br>
								Vänligen kontakta oss om något behöver ändras.
							`,
							from: {
								name: currentUser.firstname + ' ' + currentUser.lastname,
								email: currentUser.email
							}
						});

						if (result.ok) {
							addToast({
								type: AppToastType.SUCCESS,
								message: 'Bekräftelsemail skickat',
								description: `Ett bekräftelsemail skickades till ${clientEmail}.`
							});
						} else {
							addToast({
								type: AppToastType.CANCEL,
								message: 'Fel vid utskick',
								description: `Kunde inte skicka bekräftelsemail till ${clientEmail}.`
							});
						}
					}
				}

				onClose();
			}
		} else {
			const result = await createBooking(bookingObject, type);

			if (result.success) {
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Bokning genomförd',
					description: `Bokningen skapades klockan ${bookingObject.time} den ${bookingObject.date}.`
				});

				if (type === 'training' && bookingObject.clientId) {
					const clientEmail = getClientEmails(bookingObject.clientId);
					if (clientEmail) {
						await sendMail({
							to: clientEmail,
							subject: 'Bokningsbekräftelse',
							header: 'Bekräftelse på din bokning',
							subheader: 'Tack för din bokning!',
							body: `
								Hej! Din bokning är bekräftad:<br><br>
								${bookingObject.date} kl ${bookingObject.time}<br><br>
								Vänligen kontakta oss om något behöver ändras.
							`,
							from: {
								name: currentUser.firstname + ' ' + currentUser.lastname,
								email: currentUser.email
							}
						});

						addToast({
							type: AppToastType.SUCCESS,
							message: 'Bekräftelsemail skickat',
							description: `Ett bekräftelsemail skickades till ${clientEmail}.`
						});
					}
				}

				onClose();
			} else {
				addToast({
					type: AppToastType.CANCEL,
					message: 'Något gick fel',
					description: `Något gick fel, försök igen eller kontakta IT.`
				});
			}
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
			bind:repeatedBookings
			bind:selectedIsUnavailable
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
