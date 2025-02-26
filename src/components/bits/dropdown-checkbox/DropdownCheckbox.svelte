<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { clickOutside } from '$lib/actions/clickOutside';
	import IconArrowDown from '$lib/icons/IconArrowDown.svelte';
	import Checkbox from '../checkbox/Checkbox.svelte';

	export let id: string;
	export let label: string;
	export let placeholder: string = 'Välj alternativ';
	export let selectedValues: any[] = [];
	export let options: { name: string; value: any }[] = [];
	export let disabled: boolean = false;
	export let error: boolean = false;
	export let errorMessage: string = '';
	export let errors: string[] | undefined = undefined;
	export let extraWrapperClasses: string = '';
	export let maxNumberOfSuggestions: number | undefined = undefined;
	export let infiniteScroll: boolean = false;
	export let search: boolean = false; // Enables search input

	const dispatch = createEventDispatcher();
	let showDropdown = false;
	let activeIndex = -1;
	let searchQuery = '';
	let suggestionsListElement: HTMLUListElement;
	let totalAvailableSuggestions = options.length;

	// Toggle dropdown
	function toggleDropdown(event?: MouseEvent) {
		event?.stopPropagation();
		showDropdown = !showDropdown;
		activeIndex = -1;
	}

	// Close dropdown
	function closeDropdown() {
		showDropdown = false;
		activeIndex = -1;
	}

	// Filter options based on search query
	$: filteredOptions = options
		.filter((option) => option.name.toLowerCase().includes(searchQuery.toLowerCase()))
		.slice(0, maxNumberOfSuggestions);

	// Handle selection change
	function handleCheckboxChange(optionValue: any, checked: boolean) {
		let updatedSelection = checked
			? [...selectedValues, optionValue]
			: selectedValues.filter((v) => v !== optionValue);

		dispatch('change', { selected: updatedSelection });
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (!showDropdown) {
			if (event.key === 'ArrowDown' || event.key === 'Enter') {
				toggleDropdown();
			}
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
				activeIndex = (activeIndex + 1) % filteredOptions.length;
				break;
			case 'ArrowUp':
				activeIndex = (activeIndex - 1 + filteredOptions.length) % filteredOptions.length;
				break;
			case 'Enter':
				handleCheckboxChange(
					filteredOptions[activeIndex].value,
					!selectedValues.includes(filteredOptions[activeIndex].value)
				);
				break;
			case 'Escape':
				closeDropdown();
				break;
		}
	}

	// Handle infinite scroll
	function onSuggestionsScroll() {
		if (!infiniteScroll || !maxNumberOfSuggestions) return;

		const { scrollTop, scrollHeight, clientHeight } = suggestionsListElement;
		const isAtBottom = scrollHeight - scrollTop === clientHeight;

		if (isAtBottom && maxNumberOfSuggestions < totalAvailableSuggestions) {
			maxNumberOfSuggestions += 20;
		}
	}
</script>

<!-- Wrapper -->
<div class="relative flex w-full flex-col gap-1" use:clickOutside={closeDropdown}>
	<label for={id} class="block text-base font-medium text-gray">{label}</label>

	<!-- Dropdown Button -->
	<button
		type="button"
		{id}
		class="group flex w-full items-center justify-between rounded border border-gray bg-white px-3 py-2 text-left text-black transition-colors duration-150 hover:bg-gray hover:text-white focus:outline-blue-500"
		on:click={toggleDropdown}
		aria-haspopup="listbox"
		aria-expanded={showDropdown}
		aria-label={label}
		{disabled}
	>
		{selectedValues.length > 0 ? `${selectedValues.length} valda` : placeholder}
		<IconArrowDown
			size="12px"
			extraClasses={`transform transition-all duration-300 group-hover:text-white
				${showDropdown ? 'rotate-180 text-white' : 'text-gray'}
			`}
		/>
	</button>

	<!-- Show Error Message if exists -->
	{#if error && errorMessage}
		<p class="mt-1 text-sm text-red-500">{errorMessage}</p>
	{/if}
	{#if errors && errors.length > 0}
		<p class="mt-1 text-sm text-red-500">{errors[0]}</p>
	{/if}

	<!-- Dropdown List -->
	{#if showDropdown}
		<ul
			bind:this={suggestionsListElement}
			class="absolute top-full z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-md"
			role="listbox"
			on:keydown={handleKeydown}
			on:scroll={onSuggestionsScroll}
		>
			<!-- Search Input -->
			{#if search}
				<li class="p-2">
					<input
						type="text"
						class="w-full rounded-lg border p-2 focus:outline-blue"
						placeholder="Sök..."
						bind:value={searchQuery}
						on:keydown={handleKeydown}
					/>
				</li>
			{/if}

			{#each filteredOptions as option, index}
				<li class="flex cursor-pointer items-center p-2 hover:bg-gray hover:text-white">
					<Checkbox
						id={option.name + index}
						name={option.name}
						checked={selectedValues.includes(option.value)}
						label={option.name}
						on:change={(event) => handleCheckboxChange(option.value, event.detail.checked)}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</div>
