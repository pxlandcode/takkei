<script lang="ts">
	import { clickOutside } from '$lib/actions/clickOutside';
	import IconArrowDown from '$lib/icons/IconArrowDown.svelte';
	import { createEventDispatcher } from 'svelte';

	export let id: string;
	export let label: string;
	export let placeholder: string = 'Välj ett alternativ';
	export let options: string[] = [];
	export let disabled: boolean = false;
	export let selectedValue: string = '';

	// Accept an errors object for validation handling
	export let errors: Record<string, string> = {};

	let showDropdown = false;
	let listRef: HTMLUListElement | null = null;
	let activeIndex: number = -1;

	const dispatch = createEventDispatcher();

	// Select an option and close dropdown
	function selectOption(option: string) {
		selectedValue = option;
		showDropdown = false;
		activeIndex = -1;
		dispatch('change', { value: option });
	}

	// Toggle dropdown visibility when clicking the button
	function toggleDropdown(event: Event) {
		if (disabled) return;
		event.stopPropagation(); // Prevent immediate closing
		showDropdown = !showDropdown;
		activeIndex = -1;
	}

	// Close dropdown when clicking outside
	function closeDropdown() {
		showDropdown = false;
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (!showDropdown) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeIndex = (activeIndex + 1) % options.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = (activeIndex - 1 + options.length) % options.length;
		} else if (event.key === 'Enter' && activeIndex >= 0) {
			selectOption(options[activeIndex]);
		} else if (event.key === 'Escape') {
			showDropdown = false;
		}
	}
</script>

<div class="relative flex w-full flex-col gap-1">
	<label for={id} class="block text-base font-medium text-white">{label}</label>

	<!-- Dropdown Button -->
	<button
		type="button"
		{id}
		class={`flex w-full flex-row items-center justify-between rounded border px-3 py-2 text-left focus:outline-blue-500 
			${errors[id] ? 'border-red-500' : 'border-white'} 
			${showDropdown ? 'bg-black text-white' : 'bg-white text-black'} 
			transition-colors duration-150`}
		on:click={toggleDropdown}
		aria-haspopup="listbox"
		aria-expanded={showDropdown}
		aria-label={label}
		{disabled}
	>
		{selectedValue || placeholder}
		<IconArrowDown
			size="12px"
			extraClasses={`transform transition-all duration-300 
				${showDropdown ? 'rotate-180 text-white' : 'text-black'}
			`}
		/>
	</button>

	<!-- Show Error Message if exists -->
	{#if errors[id]}
		<p class="mt-1 text-sm text-red-500">{errors[id]}</p>
	{/if}

	<!-- Dropdown List -->
	{#if showDropdown && options.length > 0}
		<ul
			bind:this={listRef}
			class="absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-md"
			role="listbox"
			on:keydown={handleKeydown}
			use:clickOutside={closeDropdown}
		>
			{#each options as option, i}
				<li
					class={`cursor-pointer hover:bg-black ${i === activeIndex ? 'bg-black text-white' : 'text-black'}`}
					aria-selected={selectedValue === option}
					role="option"
				>
					<button
						on:click={() => selectOption(option)}
						class="w-full px-3 py-2 text-left hover:text-white focus:bg-black focus:text-white focus:outline-white"
					>
						{option}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
