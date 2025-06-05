<script lang="ts">
	import Dropdown from '../dropdown/Dropdown.svelte';
	import { fetchAvailableSlots } from '$lib/services/api/bookingService';
	import Input from '../Input/Input.svelte';

	export let selectedDate: string = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
	export let selectedTime: string = '';
	export let trainerId: number;
	export let locationId: number;
	export let roomId: number;
	export let label = 'Tid';

	let loading = false;
	let availableTimes: string[] = [];

	let showWarning = false;

	// Fetch available slots
	async function updateSlots() {
		showWarning = false;
		if (selectedDate && trainerId != null && locationId != null && roomId != null) {
			loading = true;
			availableTimes = [];

			try {
				const res = await fetchAvailableSlots({
					date: selectedDate,
					trainerId,
					locationId,
					roomId
				});
				availableTimes = res;
			} catch (e) {
				console.error('Error fetching available slots:', e);
				showWarning = true;
			} finally {
				loading = false;
			}
		} else {
			showWarning = true;
			availableTimes = [];
		}
	}

	$: selectedDate, trainerId, locationId, roomId, updateSlots();

	function missingFields(): string[] {
		const missing = [];
		if (!selectedDate) missing.push('datum');
		if (trainerId == null) missing.push('tränare');
		if (locationId == null) missing.push('plats');
		if (roomId == null) missing.push('rum');
		return missing;
	}
</script>

{#if loading}
	<div class="flex items-center gap-2 py-2 text-sm text-gray-500">
		<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
			/>
		</svg>
		Laddar tillgängliga tider...
	</div>
{:else if !showWarning || availableTimes.length > 0}
	<div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
		<Input label="Datum" type="date" bind:value={selectedDate} />

		<Dropdown
			id="available-times"
			{label}
			bind:selectedValue={selectedTime}
			options={availableTimes.map((t) => ({ label: t, value: t }))}
			placeholder={availableTimes.length !== 0 ? 'Välj tid' : 'Inga tillgängliga tider'}
			openPosition="up"
			disabled={availableTimes.length === 0}
		/>
	</div>
{/if}

{#if showWarning}
	<p class="text-sm font-medium text-red-600">
		Välj {missingFields().join(', ')} innan du kan se lediga tider.
	</p>
{/if}
