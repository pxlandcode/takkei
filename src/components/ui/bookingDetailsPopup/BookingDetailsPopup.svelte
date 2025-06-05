<script lang="ts">
	import type { FullBooking } from '$lib/types/calendarTypes';
	import Button from '../../bits/button/Button.svelte';
	import { formatTime } from '$lib/helpers/calendarHelpers/calendar-utils';
	import { createEventDispatcher } from 'svelte';

	export let booking: FullBooking;

	const dispatch = createEventDispatcher();

	const startTime = new Date(booking.booking.startTime);
	const endTime = new Date(booking.booking.endTime ?? startTime.getTime() + 60 * 60 * 1000);

	function handleEdit() {
		dispatch('edit', { booking });
	}

	function handleDelete() {
		dispatch('delete', { booking });
	}
</script>

<div class="flex w-[600px] flex-col gap-4 bg-white">
	<div class="mt-4 flex items-center justify-between">
		<h2 class="text-xl font-semibold">Bokningsdetaljer</h2>
		<div class="flex gap-4">
			<Button iconLeft="Edit" text="Redigera" variant="primary" small on:click={handleEdit} />
			<Button
				iconLeft="Trash"
				iconColor="error"
				text="Ta bort"
				variant="secondary"
				small
				confirmOptions={{
					title: 'Är du säker?',
					description: 'Att ta bort en bokning kan inte ångras. Vill du fortsätta?',
					action: handleDelete
				}}
			/>
		</div>
	</div>
	<p class="text-gray-600">
		<strong>Kund:</strong>
		{booking.client?.firstname}
		{booking.client?.lastname}
	</p>

	<p class="text-gray-600">
		<strong>Tränare:</strong>
		{booking.trainer?.firstname}
		{booking.trainer?.lastname}
	</p>

	<p class="text-gray-600">
		<strong>Plats:</strong>
		{booking.location?.name ?? 'Saknas'}
	</p>

	<p class="text-gray-600">
		<strong>Typ:</strong>
		{booking.additionalInfo.bookingContent?.kind ?? 'Okänd'}
	</p>

	<p class="text-gray-600">
		<strong>Tid:</strong>
		{formatTime(startTime.toISOString())} – {formatTime(endTime.toISOString())}
	</p>

	{#if booking.booking.tryOut}
		<p class="font-semibold text-orange-600">Prova-på-bokning</p>
	{/if}
</div>
