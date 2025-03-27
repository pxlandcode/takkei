<script lang="ts">
	import Button from '../../../bits/button/Button.svelte';
	import DropdownCheckbox from '../../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import TextArea from '../../../bits/textarea/TextArea.svelte';

	export let bookingObject: any;
	export let users: { name: string; value: string }[] = [];
	export let locations: { label: string; value: string }[] = [];

	function handleUserSelection(event) {
		bookingObject.attendees = [...event.detail.selected];
	}

	function onSelectAllUsers() {
		bookingObject.attendees = users.map((user) => user.value);
	}

	function onDeSelectAllUsers() {
		bookingObject.attendees = [];
	}
</script>

<!-- Booking Meeting UI -->
<div
	class="flex flex-col gap-4 rounded-lg border border-dashed border-gray-bright bg-gray-bright/10 p-6"
>
	<!-- Name Input -->
	<Input
		label="Namn"
		name="name"
		type="text"
		placeholder="Ange namn på bokningen"
		bind:value={bookingObject.name}
	/>

	<!-- Description Text Area -->
	<TextArea
		label="Beskrivning"
		name="text"
		placeholder="Lägg till en beskrivning..."
		bind:value={bookingObject.text}
	/>

	<!-- Attendees Selection -->
	<div class="flex flex-row gap-2">
		<DropdownCheckbox
			label="Deltagare"
			placeholder="Välj deltagare"
			id="users"
			options={users}
			maxNumberOfSuggestions={15}
			infiniteScroll={true}
			search
			bind:selectedValues={bookingObject.attendees}
			on:change={handleUserSelection}
		/>
		<div class="mt-6 flex flex-row gap-2">
			<Button icon="MultiCheck" variant="secondary" on:click={onSelectAllUsers} iconColor="green" />

			<Button icon="Trash" iconColor="red" variant="secondary" on:click={onDeSelectAllUsers} />
		</div>
	</div>
	§

	<!-- Location Selection -->
	<Dropdown
		label="Plats"
		placeholder="Välj plats"
		id="locations"
		options={locations}
		bind:selectedValue={bookingObject.locationId}
	/>

	<!-- Date & Time -->
	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="date" class="text-sm font-medium text-gray">Datum</label>
			<input
				type="date"
				id="date"
				bind:value={bookingObject.date}
				class="w-full rounded-lg border p-2 text-gray"
			/>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="time" class="text-sm font-medium text-gray">Starttid</label>
			<input
				type="time"
				id="time"
				bind:value={bookingObject.time}
				class="w-full rounded-lg border p-2 text-gray"
			/>
		</div>
		<div>
			<label for="endTime" class="text-sm font-medium text-gray">Sluttid</label>
			<input
				type="time"
				id="endTime"
				bind:value={bookingObject.endTime}
				class="w-full rounded-lg border p-2 text-gray"
			/>
		</div>
	</div>

	<!-- Repeat Meeting -->
	<label class="flex items-center gap-2 text-sm font-medium text-gray">
		<input type="checkbox" bind:checked={bookingObject.repeat} class="h-4 w-4" />
		Upprepa detta möte
	</label>
</div>
