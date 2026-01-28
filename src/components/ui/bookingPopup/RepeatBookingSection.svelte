<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import Button from '../../bits/button/Button.svelte';
	import RepeatBookingConflicts from './RepeatBookingConflicts.svelte';

	export let repeat = false;
	export let repeatWeeks: number | string | null = null;
	export let repeatedBookings: any[] = [];
	export let label = 'Upprepa denna bokning';
	export let checkboxVariant: 'component' | 'native' = 'component';
	export let checkboxId = 'repeat';
	export let checkboxName = 'repeat';
	export let labelClass = 'text-gray flex items-center gap-2 text-sm font-medium';
	export let checkboxClass = 'h-4 w-4';
	export let weeksLabel = 'Antal veckor framåt';
	export let weeksName = 'repeatWeeks';
	export let weeksPlaceholder: string | undefined = undefined;
	export let weeksMin: number | string = 1;
	export let weeksMax: number | string = 52;
	export let errors: Record<string, string> = {};
	export let checkDisabled = false;
	export let checkText = 'Kontrollera';

	let isCheckDisabled = false;
	const dispatch = createEventDispatcher<{ check: void }>();
	$: isCheckDisabled = checkDisabled || !repeatWeeks;
</script>

<div class="flex flex-col gap-2">
	{#if checkboxVariant === 'component'}
		<Checkbox id={checkboxId} name={checkboxName} bind:checked={repeat} label={label} />
	{:else}
		<label class={labelClass}>
			<input type="checkbox" bind:checked={repeat} class={checkboxClass} />
			{label}
		</label>
	{/if}

	{#if repeat}
		<Input
			label={weeksLabel}
			name={weeksName}
			type="number"
			bind:value={repeatWeeks}
			placeholder={weeksPlaceholder}
			min={weeksMin}
			max={weeksMax}
			{errors}
		/>

		<Button
			text={checkText}
			iconRight="MultiCheck"
			iconRightSize="16"
			variant="primary"
			full
			on:click={() => dispatch('check')}
			disabled={isCheckDisabled}
		/>

		<RepeatBookingConflicts {repeatedBookings}>
			<svelte:fragment slot="conflict" let:week>
				<slot name="conflict" {week} />
			</svelte:fragment>
			<svelte:fragment slot="ready" let:week>
				<slot name="ready" {week} />
			</svelte:fragment>
		</RepeatBookingConflicts>
	{/if}
</div>
