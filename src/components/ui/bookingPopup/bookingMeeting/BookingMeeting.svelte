<script lang="ts">
	import { get } from 'svelte/store';
	import Button from '../../../bits/button/Button.svelte';
	import DropdownCheckbox from '../../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import TextArea from '../../../bits/textarea/TextArea.svelte';
	import { user } from '$lib/stores/userStore';
	import { onMount } from 'svelte';

	export let bookingObject: {
		name?: string;
		text?: string;
		user_id?: number | null;
		user_ids?: number[];
		attendees?: number[];
		locationId?: number | null;
		date: string;
		time: string;
		endTime: string;
		repeat: boolean;
	};

	export let users: { name: string; value: number }[] = [];
	export let locations: { label: string; value: number }[] = [];
	export let isMeeting: boolean = true;

	onMount(() => {
		if (!isMeeting) {
			const currentUser = get(user);
			bookingObject.user_id = currentUser?.id ?? null;
			bookingObject.attendees = [currentUser?.id];
			bookingObject.user_ids = [currentUser?.id];
		}
	});

	function handleUserSelection(event) {
		bookingObject.attendees = [...event.detail.selected];
		bookingObject.user_ids = [...event.detail.selected];
		bookingObject.user_id = bookingObject.attendees?.[0] ?? null;
	}

	function onSelectAllUsers() {
		const selectedIds = users.map((user) => user.value);
		bookingObject.attendees = selectedIds;
		bookingObject.user_ids = selectedIds;
		bookingObject.user_id = selectedIds[0] ?? null;
	}

	function onDeSelectAllUsers() {
		bookingObject.attendees = [];
		bookingObject.user_ids = [];
		bookingObject.user_id = null;
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
	{#if isMeeting}
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
				<Button
					icon="MultiCheck"
					variant="secondary"
					on:click={onSelectAllUsers}
					iconColor="green"
				/>
				<Button icon="Trash" iconColor="red" variant="secondary" on:click={onDeSelectAllUsers} />
			</div>
		</div>

		<!-- Location Selection -->
		<Dropdown
			label="Plats"
			placeholder="Välj plats"
			id="locations"
			options={locations}
			bind:selectedValue={bookingObject.locationId}
		/>
	{/if}

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
