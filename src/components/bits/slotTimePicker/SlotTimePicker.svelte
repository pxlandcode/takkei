<!-- src/lib/components/bits/slotTimePicker/SlotTimePicker.svelte -->
<script lang="ts">
	import Dropdown from '../dropdown/Dropdown.svelte';
	import { fetchAvailableSlots } from '$lib/services/api/bookingService';
	import Input from '../Input/Input.svelte';
	import { createEventDispatcher } from 'svelte';

	export let selectedDate: string = new Date().toISOString().slice(0, 10);
	export let selectedTime: string = '';
	export let trainerId: number;
	export let locationId: number;
	export let label = 'Tid';
	export let errors: Record<string, string> = {};
	export let dateField: string = 'date';
	export let timeField: string = 'time';

	export let checkUsersBusy: boolean = false;
	export let traineeUserId: number | null = null;

	const dispatch = createEventDispatcher();

	let loading = false;
	let availableSlots: string[] = [];
	let outsideAvailabilitySlots: string[] = [];
	let sortedOptions: { label: string; value: string; unavailable: boolean }[] = [];

	let showWarning = false;

	function timeToMinutes(time: string): number {
		const [h, m] = time.split(':').map(Number);
		return h * 60 + m;
	}

	async function updateSlots() {
		showWarning = false;
		if (selectedDate && trainerId != null && locationId != null) {
			loading = true;
			availableSlots = [];
			outsideAvailabilitySlots = [];
			sortedOptions = [];
			try {
				const res = await fetchAvailableSlots({
					date: selectedDate,
					trainerId,
					locationId,
					checkUsersBusy,
					userId: traineeUserId ?? undefined
				});

				availableSlots = res.availableSlots ?? [];
				outsideAvailabilitySlots = res.outsideAvailabilitySlots ?? [];

				const merged = [
					...availableSlots.map((t) => ({ label: t, value: t, unavailable: false })),
					...outsideAvailabilitySlots.map((t) => ({ label: t, value: t, unavailable: true }))
				];

				sortedOptions = merged.sort((a, b) => timeToMinutes(a.value) - timeToMinutes(b.value));
			} catch (e) {
				console.error('Error fetching available slots:', e);
				showWarning = true;
			} finally {
				loading = false;
			}
		} else {
			showWarning = true;
			availableSlots = [];
			outsideAvailabilitySlots = [];
			sortedOptions = [];
		}
	}

	$: selectedDate, trainerId, locationId, checkUsersBusy, traineeUserId, updateSlots();

	function missingFields(): string[] {
		const missing: string[] = [];
		if (!selectedDate) missing.push('datum');
		if (trainerId == null) missing.push('tränare');
		if (locationId == null) missing.push('plats');
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
{:else if !showWarning || availableSlots.length > 0 || outsideAvailabilitySlots.length > 0}
	<div class="grid grid-cols-1 gap-2 xl:grid-cols-2">
		<Input label="Datum" name={dateField} type="date" bind:value={selectedDate} {errors} />
		<Dropdown
			id={timeField}
			{label}
			bind:selectedValue={selectedTime}
			options={sortedOptions}
			placeholder="Välj tid"
			openPosition="up"
			disabled={sortedOptions.length === 0}
			{errors}
			on:change={() => {
				const selected = sortedOptions.find((opt) => opt.value === selectedTime);
				dispatch('unavailabilityChange', selected?.unavailable ?? false);
			}}
		/>
	</div>
{/if}

{#if showWarning}
	<p class="text-sm font-medium text-red-600">
		Välj {missingFields().join(', ')} innan du kan se lediga tider.
	</p>
{/if}
