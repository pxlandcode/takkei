<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import { clients, fetchClients, getClientEmails } from '$lib/stores/clientsStore';
	import { bookingContents, fetchBookingContents } from '$lib/stores/bookingContentStore';
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
	import Button from '../../bits/button/Button.svelte';
	import BookingTraining from './bookingTraining/BookingTraining.svelte';
	import BookingPractice from './bookingPractice/BookingPractice.svelte';
	import BookingMeeting from './bookingMeeting/BookingMeeting.svelte';
	import OptionsSelect from '../../bits/options-select/OptionsSelect.svelte';
	import { user } from '$lib/stores/userStore';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { get } from 'svelte/store';
	import {
		handleMeetingOrPersonalBooking,
		handleTrainingBooking
	} from '$lib/helpers/bookingHelpers/bookingHelpers';
	import { openPopup, popupStore, closePopup, type PopupState } from '$lib/stores/popupStore';
	import { handleBookingEmail } from '$lib/helpers/bookingHelpers/bookingHelpers';
	import MailComponent from '../mailComponent/MailComponent.svelte';

	export let startTime: Date | null = null;
	export let clientId: number | null = null;
	export let trainerId: number | null = null;

	const dispatch = createEventDispatcher();
	const popupInstance: PopupState | null = get(popupStore);

	function onClose() {
		calendarStore.refresh(fetch);
		dispatch('close');
		if (get(popupStore) === popupInstance) {
			closePopup();
		}
	}

	let selectedBookingComponent:
		| 'training'
		| 'meeting'
		| 'personal'
		| 'trial'
		| 'practice'
		| 'flight'
		| 'education' = 'training';

	let repeatedBookings = [];
	let selectedIsUnavailable = false;
	let currentUser = get(user);
	let formErrors: Record<string, string> = {};
	let previousComponent: typeof selectedBookingComponent | null = null;

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
		internalEducation: false,
		education: false,
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

	function removeError(field: string) {
		if (formErrors[field]) {
			const { [field]: _removed, ...rest } = formErrors;
			formErrors = rest;
		}
	}

	function maybeClearError(field: string, condition: boolean) {
		if (condition && formErrors[field]) {
			removeError(field);
		}
	}

	function isValidEndTime(): boolean {
		if (!bookingObject.endTime || !bookingObject.time) return !!bookingObject.endTime;
		return bookingObject.endTime > bookingObject.time;
	}

	function validateBooking(
		type: 'training' | 'meeting' | 'personal' | 'trial' | 'practice' | 'flight' | 'education'
	): Record<string, string> {
		const errors: Record<string, string> = {};

		const hasDate = !!bookingObject.date;
		const hasTime = !!bookingObject.time;

		if (type === 'training' || type === 'trial' || type === 'flight') {
			if (!bookingObject.trainerId) errors.users = 'Välj en tränare.';
			if ((type === 'training' || type === 'trial') && !bookingObject.clientId)
				errors.clients = 'Välj en klient.';
			if (!bookingObject.locationId) errors.locations = 'Välj en plats.';
			if (type !== 'flight' && !bookingObject.bookingType?.value)
				errors.bookingType = 'Välj ett innehåll.';
			if (!hasDate) errors.date = 'Välj ett datum.';
			if (!hasTime) errors.time = 'Välj en tid.';
		}

		if (type === 'practice' || type === 'education') {
			if (!bookingObject.trainerId) errors.trainer = 'Välj en tränare.';
			if (type === 'practice' && !bookingObject.user_id) errors.trainee = 'Välj en trainee.';
			if (!bookingObject.locationId) errors.locations = 'Välj en plats.';
			if (!hasDate) errors.date = 'Välj ett datum.';
			if (!hasTime) errors.time = 'Välj en tid.';
		}

		if (type === 'meeting' || type === 'personal') {
			if (type === 'meeting') {
				if (!bookingObject.name?.trim()) errors.name = 'Ange ett namn för bokningen.';
				if (!bookingObject.attendees || bookingObject.attendees.length === 0)
					errors.attendees = 'Välj minst en deltagare.';
			} else if (!bookingObject.user_id) {
				errors.attendees = 'Ange vem bokningen gäller.';
			}

			if (!hasDate) errors.date = 'Välj ett datum.';
			if (!hasTime) errors.time = 'Välj en starttid.';

			if (!bookingObject.endTime) {
				errors.endTime = 'Ange en sluttid.';
			} else if (bookingObject.time && bookingObject.endTime <= bookingObject.time) {
				errors.endTime = 'Sluttiden måste vara efter starttiden.';
			}
		}

		return errors;
	}

	// Reactive booking type fallback
	$: {
		if (selectedBookingComponent === 'personal') {
			bookingObject.bookingType = { label: 'Privat', value: 'Private' };
			bookingObject.isTrial = false;
			bookingObject.internalEducation = false;
			bookingObject.education = false;
			bookingObject.user_id = null;
			bookingObject.clientId = null;
			bookingObject.internal = false;
			bookingObject.attendees = [];
			bookingObject.user_ids = [];
		} else if (selectedBookingComponent === 'meeting') {
			bookingObject.bookingType = { label: 'Möte', value: 'Meeting' };
			bookingObject.isTrial = false;
			bookingObject.internalEducation = false;
			bookingObject.education = false;
			bookingObject.user_id = null;
			bookingObject.clientId = null;
			bookingObject.internal = false;
		} else if (selectedBookingComponent === 'trial') {
			bookingObject.bookingType = null;
			bookingObject.isTrial = true;
			bookingObject.internalEducation = false;
			bookingObject.education = false;
			bookingObject.user_id = null;
			bookingObject.internal = false;
			bookingObject.attendees = [];
			bookingObject.user_ids = [];
		} else if (selectedBookingComponent === 'practice') {
			bookingObject.bookingType = { label: 'Praktiktimme', value: 'Practice' };
			bookingObject.isTrial = false;
			bookingObject.internalEducation = true;
			bookingObject.education = false;
			bookingObject.clientId = null;
			bookingObject.internal = false;
			bookingObject.attendees = [];
			bookingObject.user_ids = [];
		} else if (selectedBookingComponent === 'flight') {
			bookingObject.bookingType = null;
			bookingObject.isTrial = false;
			bookingObject.internal = true;
			bookingObject.internalEducation = false;
			bookingObject.education = false;
			bookingObject.repeat = false;
			bookingObject.attendees = [];
			bookingObject.user_ids = [];
		} else if (selectedBookingComponent === 'education') {
			bookingObject.bookingType = { label: 'Utbildningstimme', value: 'Education' };
			bookingObject.isTrial = false;
			bookingObject.internalEducation = false;
			bookingObject.education = true;
			bookingObject.clientId = null;
			bookingObject.user_id = null;
			bookingObject.internal = false;
			bookingObject.attendees = [];
			bookingObject.user_ids = [];
		} else {
			bookingObject.bookingType = null;
			bookingObject.isTrial = false;
			bookingObject.internalEducation = false;
			bookingObject.education = false;
			bookingObject.user_id = null;
			bookingObject.internal = false;
			bookingObject.attendees = [];
			bookingObject.user_ids = [];
		}
	}

	// Sync user_ids and user_id from attendees
	$: if (selectedBookingComponent !== previousComponent) {
		formErrors = {};
		previousComponent = selectedBookingComponent;
	}

	$: maybeClearError('users', !!bookingObject.trainerId);
	$: maybeClearError('trainer', !!bookingObject.trainerId);
	$: maybeClearError('clients', !!bookingObject.clientId);
	$: maybeClearError('locations', !!bookingObject.locationId);
	$: maybeClearError('bookingType', !!bookingObject.bookingType?.value);
	$: maybeClearError('date', !!bookingObject.date);
	$: maybeClearError('time', !!bookingObject.time);
	$: maybeClearError('trainee', !!bookingObject.user_id);
	$: maybeClearError('attendees', !!bookingObject.attendees && bookingObject.attendees.length > 0);
	$: maybeClearError('name', !!bookingObject.name?.trim());
	$: maybeClearError('endTime', isValidEndTime());

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

		const validationErrors = validateBooking(type);
		formErrors = validationErrors;
		if (Object.keys(validationErrors).length > 0) {
			return;
		}

		const locationName = getLocationLabelFromId(bookingObject.locationId);

		let bookedDates: { date: string; time: string; locationName?: string }[] = [];
		let success = false;

		if (type === 'training' || type === 'trial' || type === 'practice' || type === 'flight') {
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
					openPopup({
						header: `Maila bokningsbekräftelse till ${clientEmail}`,
						icon: 'Mail',
						component: MailComponent,
						width: '900px',
						props: {
							prefilledRecipients: [clientEmail],
							subject: 'Bokningsbekräftelse',
							header: 'Bekräftelse på dina bokningar',
							subheader: 'Tack för din bokning!',
							body: `
							Hej!<br><br>
							Jag har bokat in dig följande tider:<br>
							${bookedDates
								.map(
									(b) => `${b.date} kl. ${b.time}${b.locationName ? ` på ${b.locationName}` : ''}`
								)
								.join('<br>')}<br><br>
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

		console.log('success', success);
		if (success) {
			console.log('hello');
			formErrors = {};
			onClose();
		}
	}
</script>

<!-- Booking Manager UI -->
<div class="flex w-full max-w-full flex-col gap-4 bg-white sm:max-w-[600px]">
	<!-- Booking Type Selector -->

	<!-- Booking Type Selector -->

	<OptionsSelect
		bind:selectedValue={selectedBookingComponent}
		options={[
			{ label: 'Träning', icon: 'Training', value: 'training' },
			{ label: 'Provträning', icon: 'ShiningStar', value: 'trial' },
			{ label: 'Praktiktimme', icon: 'Wrench', value: 'practice' },
			{ label: 'Utbildning', icon: 'GraduationCap', value: 'education' },
			{ label: 'Flygtimme', icon: 'Plane', value: 'flight' },
			{ label: 'Möte', icon: 'Meeting', value: 'meeting' },
			{ label: 'Personlig', icon: 'Person', value: 'personal' }
		]}
	/>

	<!-- Dynamic Booking Component -->
	{#if selectedBookingComponent === 'training' || selectedBookingComponent === 'trial' || selectedBookingComponent === 'flight'}
		<BookingTraining
			bind:bookingObject
			bind:repeatedBookings
			bookingContents={($bookingContents || []).map((content) => ({
				value: content.id,
				label: capitalizeFirstLetter(content.kind)
			}))}
			isTrial={bookingObject.isTrial}
			isFlight={bookingObject.internal}
			errors={formErrors}
		/>
		<!-- render -->
	{:else if selectedBookingComponent === 'practice'}
		<BookingPractice
			bind:bookingObject
			users={($users || []).map((u) => ({ label: `${u.firstname} ${u.lastname}`, value: u.id }))}
			locations={($locations || []).map((l) => ({ label: l.name, value: l.id }))}
			kind="practice"
			bind:repeatedBookings
			errors={formErrors}
		/>
	{:else if selectedBookingComponent === 'education'}
		<BookingPractice
			bind:bookingObject
			users={($users || []).map((u) => ({ label: `${u.firstname} ${u.lastname}`, value: u.id }))}
			locations={($locations || []).map((l) => ({ label: l.name, value: l.id }))}
			kind="education"
			bind:repeatedBookings
			errors={formErrors}
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
			errors={formErrors}
		/>
	{:else if selectedBookingComponent === 'personal'}
		<BookingMeeting bind:bookingObject isMeeting={false} errors={formErrors} />
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
