<script lang="ts">
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import Button from '../../bits/button/Button.svelte';

	export let week: any;
	export let onResolve: ((weekNumber: number) => void) | undefined = undefined;
	export let onIgnore: ((weekNumber: number) => void) | undefined = undefined;
	export let resolveText = 'Lös';
	export let ignoreText = 'Ignorera';
	export let dropdownLabel = 'Välj alternativ tid';
	export let dropdownPlaceholder = 'Tillgängliga tider';
	export let dropdownIdPrefix = 'week';
	export let showDropdownWhenEmpty = false;
	export let noOptionsMessage = 'Ingen tillgänglig tid denna dag. Konflikten kan inte lösas.';

	let suggestedOptions: { label: string; value: string }[] = [];
	let hasSuggestions = false;
	$: suggestedOptions = (week?.suggestedTimes ?? []).map((t: string) => ({
		label: t,
		value: t
	}));
	$: hasSuggestions = suggestedOptions.length > 0;
</script>

<div class="border-red bg-red/10 mb-2 rounded-sm border p-3">
	{week.date}, kl {week.selectedTime}
	<div class="mt-2">
		{#if showDropdownWhenEmpty || hasSuggestions}
			<Dropdown
				label={dropdownLabel}
				placeholder={dropdownPlaceholder}
				id={`${dropdownIdPrefix}-${week.week}-time`}
				options={suggestedOptions}
				bind:selectedValue={week.selectedTime}
			/>
		{/if}
		{#if !hasSuggestions}
			<p class="mt-2 text-xs text-red-600">{noOptionsMessage}</p>
		{/if}
		<div class="mt-2 flex gap-2">
			<Button
				text={resolveText}
				variant="primary"
				small
				disabled={!hasSuggestions}
				on:click={() => onResolve?.(week.week)}
			/>
			<Button
				text={ignoreText}
				variant="secondary"
				small
				on:click={() => onIgnore?.(week.week)}
			/>
		</div>
	</div>
</div>
