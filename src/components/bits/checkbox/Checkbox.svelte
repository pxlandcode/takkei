<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let id: string = '';
	export let label: string = '';
	export let name: string = '';
	export let checked: boolean = false;
	export let errors: Record<string, string> = {};

	const dispatch = createEventDispatcher();

	function handleClick() {
		checked = !checked;
		dispatch('change', { checked });
	}
</script>

<div class="flex flex-col">
	<div class="inline-flex items-center">
		<span class="relative flex cursor-pointer items-center">
			<input
				type="checkbox"
				{id}
				{name}
				bind:checked
				on:click|stopPropagation={handleClick}
				class="peer h-5 w-5 cursor-pointer appearance-none rounded border
					{errors[name] ? 'border-red-500' : 'border-gray-300'} 
					bg-white shadow transition-all hover:shadow-md focus:ring-blue-500"
			/>
			<span
				class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform text-black opacity-0 peer-checked:opacity-100"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-3.5 w-3.5"
					viewBox="0 0 20 20"
					fill="currentColor"
					stroke="currentColor"
					stroke-width="1"
				>
					<path
						fill-rule="evenodd"
						d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
						clip-rule="evenodd"
					></path>
				</svg>
			</span>
		</span>
		<label for={id} class="pl-2 text-sm">{label}</label>
	</div>

	{#if errors[name]}
		<p class="mt-1 text-sm text-red-500">{errors[name]}</p>
	{/if}
</div>
