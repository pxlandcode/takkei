<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { get } from 'svelte/store';

	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { clients, fetchClients, getClientEmails } from '$lib/stores/clientsStore';
	import { bookingContents, fetchBookingContents } from '$lib/stores/bookingContentStore';
	import { updateBooking, cancelBooking } from '$lib/services/api/bookingService';
	import { sendMail } from '$lib/services/mail/mailClientService';
	import { user } from '$lib/stores/userStore';
	import { calendarStore } from '$lib/stores/calendarStore';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import OptionButton from '../../bits/optionButton/OptionButton.svelte';
	import SlotTimePicker from '../../bits/slotTimePicker/SlotTimePicker.svelte';
	import Button from '../../bits/button/Button.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
	import { loadingStore } from '$lib/stores/loading';

	export let bookingObject: any;

	const dispatch = createEventDispatcher();

	let availableRooms = [];
	let selectedIsUnavailable = false;

	let typeOptions = [];

	onMount(async () => {
		await Promise.all([fetchLocations(), fetchUsers(), fetchClients(), fetchBookingContents()]);

		typeOptions = $bookingContents.map((c) => ({
			value: c.id,
			label: capitalizeFirstLetter(c.kind)
		}));

		if (!bookingObject.bookingType && typeOptions.length > 0) {
			bookingObject.bookingType = typeOptions[0];
		}
	});

	$: {
		const loc = $locations.find((l) => l.id === bookingObject.locationId);
		availableRooms = loc?.rooms ?? [];
		if (availableRooms.length === 1) bookingObject.roomId = availableRooms[0].id;
	}

	function handleBookingTypeSelection(event: CustomEvent<string>) {
		const selected = typeOptions.find((opt) => opt.value === event.detail);
		if (selected) bookingObject.bookingType = selected;
	}

	async function handleUpdate() {
		loadingStore.loading(true, 'Uppdaterar bokning...');

		const result = await updateBooking(bookingObject);

		if (result.success) {
			const clientEmail = getClientEmails(bookingObject.clientId);
			const currentUser = get(user);

			if (clientEmail) {
				await sendMail({
					to: clientEmail,
					subject: 'Bokningsuppdatering',
					header: 'Din bokning har uppdaterats',
					subheader: 'Ny tid eller plats',
					body: `
					Hej! Din bokning har blivit uppdaterad.<br><br>
					${bookingObject.date} kl ${bookingObject.time}<br><br>
					Vänligen kontakta oss om du har några frågor.
				`,
					from: {
						name: `${currentUser.firstname} ${currentUser.lastname}`,
						email: currentUser.email
					}
				});
			}

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Bokning uppdaterad',
				description: 'Ändringarna sparades och bekräftelse skickades.'
			});

			calendarStore.refresh(fetch);
			onClose();
		} else {
			addToast({
				type: AppToastType.CANCEL,
				message: 'Misslyckades',
				description: result.message ?? 'Bokningen kunde inte uppdateras.'
			});
		}

		loadingStore.loading(false);
	}

	function onClose() {
		dispatch('close');
	}
</script>

<div
	class="flex w-[600px] flex-col gap-6 rounded-lg border border-dashed border-gray-bright bg-gray-bright/10 p-6"
>
	<h2 class="text-xl font-semibold">Redigera bokning</h2>

	<div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
		<Dropdown
			label="Tränare"
			id="trainer"
			options={$users.map((u) => ({ label: `${u.firstname} ${u.lastname}`, value: u.id }))}
			bind:selectedValue={bookingObject.trainerId}
		/>

		<Dropdown
			label="Klient"
			id="client"
			options={$clients.map((c) => ({ label: `${c.firstname} ${c.lastname}`, value: c.id }))}
			bind:selectedValue={bookingObject.clientId}
			disabled
		/>
	</div>

	<!-- Location -->
	<Dropdown
		label="Plats"
		id="location"
		options={$locations.map((l) => ({ label: l.name, value: l.id }))}
		bind:selectedValue={bookingObject.locationId}
	/>

	<!-- Room (if multiple) -->
	{#if availableRooms.length > 1}
		<Dropdown
			label="Rum"
			id="room"
			options={availableRooms.map((r) => ({ label: r.name, value: r.id }))}
			bind:selectedValue={bookingObject.roomId}
		/>
	{/if}

	<!-- Booking Type -->
	<OptionButton
		label="Typ"
		options={typeOptions}
		bind:selectedOption={bookingObject.bookingType}
		on:select={handleBookingTypeSelection}
		full
		size="small"
	/>

	<!-- Time Picker -->
	<SlotTimePicker
		bind:selectedDate={bookingObject.date}
		bind:selectedTime={bookingObject.time}
		trainerId={bookingObject.trainerId}
		locationId={bookingObject.locationId}
		roomId={bookingObject.roomId}
		on:unavailabilityChange={(e) => (selectedIsUnavailable = e.detail)}
	/>

	<!-- Buttons -->
	<div class="flex justify-end gap-4">
		<Button
			text="Spara ändringar"
			variant="primary"
			disabled={$loadingStore.isLoading}
			confirmOptions={{
				title: 'Är du säker?',
				description: 'Är du säker på att du vill spara ändringarna?',
				action: handleUpdate
			}}
		/>
	</div>
</div>
