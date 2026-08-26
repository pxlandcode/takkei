<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../icon-component/Icon.svelte';

	export let options: { value: any; label: string }[] = [];
	export let selectedOption: { value: any; label: string } | null = null;

	const dispatch = createEventDispatcher();

	function selectOption(option: { value: any; label: string }) {
		selectedOption = option;
		dispatch('select', option.value);
	}
</script>

<!-- Outer container: black background + white border -->
<div class="w-full max-w-md rounded-lg border-2 border-white bg-white p-[2px]">
	<div class="flex gap-[2px] rounded-lg">
		{#each options as option, index}
			<button
				type="button"
				class={`
					h-[46px] flex-1 text-center text-sm font-semibold transition-all duration-200 active:scale-90
					${index === 0 ? 'rounded-l-md' : ''} 
					${index === options.length - 1 ? 'rounded-r-md' : ''} 
					${selectedOption?.value === option.value ? 'bg-black text-base text-white' : 'bg-white  text-black hover:bg-black/80 hover:text-base hover:text-white'}
				`}
				on:click={() => selectOption(option)}
			>
				{#if selectedOption?.value === option.value}
					<Icon icon="Check" size="16px" />
				{/if}
				{option.label}
			</button>
		{/each}
	</div>
</div>
