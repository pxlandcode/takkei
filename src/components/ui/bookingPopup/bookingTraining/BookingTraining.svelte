<script lang="ts">
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';
	import OptionButton from '../../../bits/optionButton/OptionButton.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import { user } from '$lib/stores/userStore';

	// Props
	export let bookingObject: any;
	export let bookingContents: { value: string; label: string }[] = [];
	export let users: { label: string; value: string }[] = [];
	export let clients: { label: string; value: string }[] = [];
	export let locations: { label: string; value: string }[] = [];

	// Handle selections
	function handleBookingTypeSelection(event: CustomEvent<string>) {
		bookingObject.bookingType = {
			value: event.detail,
			label: capitalizeFirstLetter(event.detail)
		};
	}

	$: if (!bookingObject.trainerId) {
		bookingObject.trainerId = $user.id;
	}
</script>

<!-- Booking Training UI -->
<div
	class="flex flex-col gap-6 rounded-lg border border-dashed border-gray-bright bg-gray-bright/10 p-6"
>
	<OptionButton
		options={bookingContents}
		bind:selectedOption={bookingObject.bookingType}
		size="small"
		on:select={handleBookingTypeSelection}
		full
	/>

	<!-- Filters -->
	<div class="flex flex-col gap-4">
		<div class="flex flex-row gap-4">
			<Dropdown
				label="Tränare"
				labelIcon="Person"
				labelIconSize="16px"
				placeholder="Välj tränare"
				id="users"
				options={users}
				search
				maxNumberOfSuggestions={15}
				infiniteScroll
				bind:selectedValue={bookingObject.trainerId}
			/>

			<Dropdown
				label="Klient"
				labelIcon="Clients"
				placeholder="Välj klient"
				id="clients"
				options={clients}
				search
				maxNumberOfSuggestions={15}
				infiniteScroll
				bind:selectedValue={bookingObject.clientId}
			/>
		</div>

		<Dropdown
			label="Plats"
			placeholder="Välj plats"
			labelIcon="Building"
			labelIconSize="16px"
			id="locations"
			options={locations}
			bind:selectedValue={bookingObject.locationId}
		/>
	</div>

	<!-- Date & Time -->
	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="date" class="text-sm font-medium text-gray-700">Datum</label>
			<input
				type="date"
				id="date"
				bind:value={bookingObject.date}
				class="w-full rounded-lg border p-2 text-gray-700"
			/>
		</div>

		<div>
			<label for="time" class="text-sm font-medium text-gray-700">Starttid</label>
			<input
				type="time"
				id="time"
				bind:value={bookingObject.time}
				class="w-full rounded-lg border p-2 text-gray-700"
			/>
		</div>
	</div>

	<!-- Repeat Booking -->
	<label class="flex items-center gap-2 text-sm font-medium text-gray-700">
		<input type="checkbox" bind:checked={bookingObject.repeat} class="h-4 w-4" />
		Upprepa denna bokning
	</label>
</div>
