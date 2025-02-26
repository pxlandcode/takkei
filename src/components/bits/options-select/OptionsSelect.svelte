<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../icon-component/Icon.svelte';

	export let options: { label: string; icon: string; value: string }[] = [];
	export let selectedValue: string | null = null;

	const dispatch = createEventDispatcher();

	// Function to handle selection
	function selectOption(value: string) {
		selectedValue = value;
		dispatch('select', { value });
	}
</script>

<div class="flex flex-col gap-2">
	<!-- Label -->
	<div class="flex flex-row gap-2">
		<Icon icon="Category" size="20px" color="gray" />
		<label class="text-sm font-medium text-gray">Bokningstyp</label>
	</div>

	<!-- Options -->
	<div class="flex gap-10">
		{#each options as option}
			<div class="flex flex-col items-center justify-center gap-2 text-center">
				<button
					class="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-lg p-2 transition-colors duration-200
					{selectedValue === option.value ? 'bg-primary text-white' : 'bg-gray text-white'}
					hover:bg-primary-hover"
					on:click={() => selectOption(option.value)}
				>
					<Icon icon={option.icon} size="40px" />
				</button>
				<p class="text-sm">{option.label}</p>
			</div>
		{/each}
	</div>
</div>

<style>
</style>
