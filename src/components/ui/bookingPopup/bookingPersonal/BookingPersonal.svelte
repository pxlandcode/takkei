<script lang="ts">
	import Input from '../../../bits/input/Input.svelte';
	import TextArea from '../../../bits/textarea/TextArea.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';

	// Props to allow parent component to control values and options
	export let bookingObject: any;
	export let locations: { label: string; value: string }[] = {};
	export let errors: Record<string, string> = {};
</script>

<!-- Booking Personal UI -->
<div
	class="flex flex-col gap-6 rounded-lg border border-dashed border-gray-bright bg-gray-bright/10 p-6"
>
	<!-- Name Input -->
	<Input
		label="Namn"
		name="name"
		type="text"
		placeholder="Ange namn på bokningen"
		bind:value={bookingObject.name}
		{errors}
	/>

	<!-- Description Text Area -->
	<TextArea
		label="Beskrivning"
		name="text"
		placeholder="Lägg till en beskrivning..."
		bind:value={bookingObject.text}
		{errors}
	/>

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
				class="text-gray0 w-full rounded-lg border p-2"
			/>
		</div>

		<div>
			<label for="time" class="text-sm font-medium text-gray">Starttid</label>
			<input
				type="time"
				id="time"
				bind:value={bookingObject.time}
				class="w-full rounded-lg border p-2 text-gray"
			/>
		</div>
	</div>

	<!-- Repeat Booking -->
	<label class="flex items-center gap-2 text-sm font-medium text-gray-700">
		<input type="checkbox" bind:checked={bookingObject.repeat} class="h-4 w-4" />
		Upprepa denna bokning
	</label>
</div>
