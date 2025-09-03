<script lang="ts">
	import Button from '../../bits/button/Button.svelte';
	import Slider from '../../bits/slider/Slider.svelte';

	export let name = ''; // "Januari", etc
	export let month = 1; // 1..12
	export let value = 0; // current allocated
	export let isAnchor = false; // locked or auto
	export let max = 1000; // slider cap for this month
	export let disabled = false; // disabled while not editing
	export let onChange: (m: number, v: number) => void;

	// slider change -> push value up
	function handleChange(e: CustomEvent<{ value: number }>) {
		onChange?.(month, e.detail.value);
	}
</script>

<div class="rounded-xl border p-3">
	<div class="mb-2 flex items-center justify-between">
		<span class="text-sm font-medium capitalize">{name}</span>
		{#if isAnchor}
			<span class="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">låst</span>
		{:else}
			<span class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">automatisk</span>
		{/if}
	</div>

	<Slider
		label=""
		min={0}
		{max}
		step={1}
		{disabled}
		{value}
		sublabel={isAnchor ? 'Låst' : 'Efter dagar'}
		on:change={handleChange}
	/>

	<div class="mt-2 flex justify-between">
		<Button
			small
			variant="secondary"
			text="Veckor"
			on:click={() => dispatchEvent(new CustomEvent('weeks'))}
		/>
		<span class="text-xs text-gray-500">sum {Math.round(value)}</span>
	</div>
</div>
