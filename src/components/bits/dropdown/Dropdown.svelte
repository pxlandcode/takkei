<script lang="ts">
	import { clickOutside } from '$lib/actions/clickOutside';
	import IconArrowDown from '$lib/icons/IconArrowDown.svelte';
	import { createEventDispatcher, onMount } from 'svelte';
	import Icon from '../icon-component/Icon.svelte';

	export let id: string;
	export let label: string;
	export let placeholder: string = 'Välj ett alternativ';
	export let options: (string | { label: string; value: any })[] = [];
	export let disabled: boolean = false;
	export let variant: 'black' | 'gray' = 'gray';
	export let selectedValue: any = '';
	export let search: boolean = false;
	export let maxNumberOfSuggestions: number | undefined = undefined;
	export let infiniteScroll: boolean = false;
	export let labelIcon: string = '';
	export let labelIconSize: string = '20px';
	export let openPosition: 'up' | 'down' | null = null;
	export let noLabel: boolean = false;
	// Accept an errors object for validation handling
	export let errors: Record<string, string> = {};

	let showDropdown = false;
	let listRef: HTMLUListElement | null = null;
	let activeIndex: number = -1;
	let searchQuery = '';
	let initialMaxNumberOfSuggestions = maxNumberOfSuggestions;
	let suggestionsListElement: HTMLUListElement;
	let totalAvailableSuggestions = options.length;

	$: totalAvailableSuggestions = options.length;

	const dispatch = createEventDispatcher();

	// Helper function to check if options are objects
	function isObjectOption(
		option: any
	): option is { label: string; value: any; unavailable?: boolean } {
		return typeof option === 'object' && option !== null && 'label' in option && 'value' in option;
	}

	// Get label for the selected value
	function getLabel(value: any): string {
		const option = options.find((opt) =>
			isObjectOption(opt) ? opt.value === value : opt === value
		);
		return isObjectOption(option) ? option.label : (option as string) || placeholder;
	}

	// Select an option and close dropdown
	function selectOption(option: string | { label: string; value: any }) {
		selectedValue = isObjectOption(option) ? option.value : option;
		showDropdown = false;
		activeIndex = -1;
		dispatch('change', { value: selectedValue });
	}

	// Toggle dropdown visibility when clicking the button
	let dropdownPosition: 'up' | 'down' = 'down';

	$: isSelectedUnavailable = (() => {
		const selected = options.find((opt) =>
			isObjectOption(opt) ? opt.value === selectedValue : opt === selectedValue
		);
		return isObjectOption(selected) && selected.unavailable;
	})();

	function toggleDropdown(event: Event) {
		if (disabled) return;
		event.stopPropagation();

		const buttonElement = event.currentTarget as HTMLElement;
		const rect = buttonElement.getBoundingClientRect();
		const spaceBelow = window.innerHeight - rect.bottom;
		const spaceAbove = rect.top;

		if (openPosition) {
			dropdownPosition = openPosition;
		} else {
			dropdownPosition = spaceBelow < 250 && spaceAbove > spaceBelow ? 'up' : 'down';
		}

		// Reset scroll and search
		maxNumberOfSuggestions = initialMaxNumberOfSuggestions ?? 50;
		searchQuery = '';
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
			activeIndex = (activeIndex + 1) % filteredOptions.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeIndex = (activeIndex - 1 + filteredOptions.length) % filteredOptions.length;
		} else if (event.key === 'Enter' && activeIndex >= 0) {
			selectOption(filteredOptions[activeIndex]);
		} else if (event.key === 'Escape') {
			showDropdown = false;
		}
	}

	// Filter options based on search query
	$: filteredOptions = options
		.filter((option) => {
			const label = isObjectOption(option) ? option.label.toLowerCase() : option.toLowerCase();
			return label.includes(searchQuery.toLowerCase());
		})
		.slice(0, maxNumberOfSuggestions);

	// Handle infinite scroll
	function onSuggestionsScroll() {
		if (!infiniteScroll || !maxNumberOfSuggestions) return;

		const { scrollTop, scrollHeight, clientHeight } = suggestionsListElement;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

		if (distanceFromBottom <= 5 && maxNumberOfSuggestions < totalAvailableSuggestions) {
			maxNumberOfSuggestions += 20;
		}
	}

	onMount(() => {
		if (!initialMaxNumberOfSuggestions) {
			initialMaxNumberOfSuggestions = 50;
		}
	});
</script>

<div class="relative flex w-full flex-col gap-1" use:clickOutside={closeDropdown}>
	<div class="mb-1 flex flex-row items-center gap-2 {noLabel ? 'hidden' : ''}">
		{#if labelIcon}
			<Icon icon={labelIcon} size={labelIconSize} color="gray" />
		{/if}

		<label for={id} class="mb-1 block text-sm font-medium text-gray">{label}</label>
	</div>
	<!-- Dropdown Button -->
	<button
		type="button"
		{id}
		class={`group flex w-full flex-row items-center justify-between rounded border px-3 py-2 text-left hover:text-white focus:outline-blue-500
	${errors[id] ? 'border-red-500' : variant === 'black' ? 'border-white' : 'border-gray'} 
	${
		isSelectedUnavailable
			? 'text-red-500'
			: showDropdown
				? variant === 'black'
					? 'bg-black text-white'
					: 'bg-gray text-white'
				: 'bg-white text-black'
	}
	${variant === 'black' ? 'hover:bg-black' : 'hover:bg-gray'}
	${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
	transition-colors duration-150`}
		on:click={toggleDropdown}
		aria-haspopup="listbox"
		aria-expanded={showDropdown}
		aria-label={label}
		{disabled}
		aria-disabled={disabled}
	>
		{getLabel(selectedValue)}
		<IconArrowDown
			size="12px"
			extraClasses={`transform transition-all duration-300 group-hover:text-white
				${showDropdown ? (variant === 'black' ? 'rotate-180 text-white' : 'rotate-180 text-white') : 'text-gray '}
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
			bind:this={suggestionsListElement}
			class={`absolute z-50 max-h-60 w-full overflow-auto rounded-sm border border-gray-bright bg-white shadow-md
			${dropdownPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}
			role="listbox"
			on:keydown={handleKeydown}
			on:scroll={onSuggestionsScroll}
			aria-labelledby={id}
			aria-disabled={disabled}
		>
			{#if search}
				<li class="p-2">
					<input
						type="text"
						class="w-full rounded-sm border p-2 focus:outline-blue"
						placeholder="Sök..."
						bind:value={searchQuery}
						on:keydown={handleKeydown}
					/>
				</li>
			{/if}

			{#each filteredOptions as option, i}
				<li
					class={`cursor-pointer hover:bg-black 
			${i === activeIndex ? 'bg-black text-white' : ''}
			${isObjectOption(option) && option.unavailable ? 'text-red-500' : 'text-black'}`}
					aria-selected={selectedValue === (isObjectOption(option) ? option.value : option)}
					role="option"
				>
					<button
						on:click={() => selectOption(option)}
						class={`w-full px-3 py-2 text-left hover:text-white focus:text-white focus:outline-white
				${variant === 'black' ? 'hover:bg-black focus:bg-black' : 'hover:bg-gray focus:bg-gray'}`}
						aria-label={isObjectOption(option) ? option.label : option}
					>
						{isObjectOption(option) ? option.label : option}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
