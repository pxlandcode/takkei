<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../icon-component/Icon.svelte';

	export let options: { label: string; icon: string; value: string }[] = [];
	export let selectedValue: string | null = null;
	export let label = 'Bokningstyp'; // optional, overridable

	const dispatch = createEventDispatcher();

	function selectOption(value: string) {
		selectedValue = value;
		dispatch('select', { value });
	}
</script>

<div class="flex flex-col gap-2">
	<!-- Label -->
	<div class="flex items-center gap-2">
		<Icon icon="Category" size="18px" color="gray" />
		<label class="text-sm font-medium text-gray">{label}</label>
	</div>

	<!-- Options (responsive grid, wraps; compact spacing) -->
	<div
		class="grid grid-cols-3
           gap-2
           sm:grid-cols-4
           md:grid-cols-7
           lg:grid-cols-7"
	>
		{#each options as option (option.value)}
			{#key option.value}
				<button
					type="button"
					title={option.label}
					aria-pressed={selectedValue === option.value}
					class="max-width-[62px] group flex flex-col items-center justify-center rounded-xl
                 border bg-white
                 px-2
                 py-2
                 text-xs text-gray transition-colors
                 hover:border-primary/60 hover:bg-primary/5
                 ${selectedValue === option.value
						? ' border-primary bg-primary/5'
						: ' border-gray-200'}"
					on:click={() => selectOption(option.value)}
				>
					<span class="flex h-6 w-6 items-center justify-center">
						<Icon
							icon={option.icon}
							size="22px"
							color={selectedValue === option.value ? 'primary' : 'text'}
						/>
					</span>
					<!-- Truncate long labels; keep compact -->
					<p class="mt-1 w-full max-w-[11ch] truncate text-center text-xxs">
						{option.label}
					</p>
				</button>
			{/key}
		{/each}
	</div>
</div>

<style>
	/* Utility for selected state without relying on :global */
	.selected {
		border-color: var(--color-primary);
		background-color: color-mix(in srgb, var(--color-primary) 10%, white);
		color: var(--color-primary);
	}
</style>
