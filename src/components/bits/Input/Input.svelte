<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let label: string = '';
	export let name: string = '';
	export let type: string = 'text';
	export let placeholder: string = '';
	export let value: string = '';
	export let disabled: boolean = false;
	export let errors: Record<string, string> = {};

	const dispatch = createEventDispatcher();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			dispatch('enter', event);
		}
	}

	// Format yymmdd-xxxx
	function formatPersonnummer(input: string) {
		const digitsOnly = input.replace(/[^\d]/g, '').slice(0, 10);

		if (digitsOnly.length <= 6) {
			return digitsOnly;
		}

		return `${digitsOnly.slice(0, 6)}-${digitsOnly.slice(6)}`;
	}

	function handleInput(event: Event) {
		const input = (event.target as HTMLInputElement).value;

		value = name === 'person_number' ? formatPersonnummer(input) : input;
	}
</script>

<div class="mb-4 w-full">
	{#if label}
		<label for={name} class="mb-1 block text-sm font-medium">
			{label}
		</label>
	{/if}

	<div class="relative" class:cancelled-overlay-bg={disabled}>
		<input
			id={name}
			{name}
			{type}
			{placeholder}
			{disabled}
			bind:value
			on:keydown={handleKeydown}
			on:input={handleInput}
			class="
				w-full
				rounded
				border
				bg-white
				px-3
				py-2
				text-black
				transition-colors
				duration-150
				focus:outline-none
				{errors[name] ? 'border-red-500' : 'border-gray-300 focus:border-gray-500'}"
		/>
	</div>

	{#if errors[name]}
		<p class="mt-1 text-sm text-red-500">{errors[name]}</p>
	{/if}
</div>

<style>
	.cancelled-overlay-bg::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 6px;
		pointer-events: none;
		background-image: repeating-linear-gradient(
			-45deg,
			rgba(0, 0, 0, 0.05) 0px,
			rgba(0, 0, 0, 0.05) 5px,
			transparent 5px,
			transparent 10px
		);
		z-index: 10;
	}
</style>
