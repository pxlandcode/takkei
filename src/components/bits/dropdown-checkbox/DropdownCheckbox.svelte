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
	export let maxNumberOfSuggestions: number = 20;
	export let infiniteScroll: boolean = false;
	export let search: boolean = false;
	export let openPosition: 'up' | 'down' | null = null;

	let dropdownPosition: 'up' | 'down' = 'down';

	const dispatch = createEventDispatcher();
	let showDropdown = false;
	let activeIndex = -1;
	let searchQuery = '';
	let suggestionsListElement: HTMLUListElement;
	let visibleCount = maxNumberOfSuggestions;

	$: totalAvailableSuggestions = options.length;

	// 🔄 Reactive filtered list
	$: filteredOptions = options
		.filter((option) => option.name.toLowerCase().includes(searchQuery.toLowerCase()))
		.slice(0, visibleCount);

	function toggleDropdown(event?: MouseEvent) {
		event?.stopPropagation();

		if (!disabled) {
			const target = event?.currentTarget as HTMLElement;
			const rect = target?.getBoundingClientRect();
			const spaceBelow = window.innerHeight - rect.bottom;
			const spaceAbove = rect.top;

			if (openPosition) {
				dropdownPosition = openPosition;
			} else {
				dropdownPosition = spaceBelow < 250 && spaceAbove > spaceBelow ? 'up' : 'down';
			}

			showDropdown = !showDropdown;
			activeIndex = -1;
			if (showDropdown) visibleCount = maxNumberOfSuggestions;
		}
	}

	function closeDropdown() {
		showDropdown = false;
		activeIndex = -1;
	}

	function handleCheckboxChange(optionValue: any, checked: boolean) {
		let updatedSelection = checked
			? [...selectedValues, optionValue]
			: selectedValues.filter((v) => v !== optionValue);

		dispatch('change', { selected: updatedSelection });
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!showDropdown) {
			if (event.key === 'ArrowDown' || event.key === 'Enter') toggleDropdown();
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
				const option = filteredOptions[activeIndex];
				if (option) {
					handleCheckboxChange(option.value, !selectedValues.includes(option.value));
				}
				break;
			case 'Escape':
				closeDropdown();
				break;
		}
	}

	function onSuggestionsScroll() {
		if (!infiniteScroll) return;

		const { scrollTop, scrollHeight, clientHeight } = suggestionsListElement;
		const isAtBottom = scrollHeight - scrollTop <= clientHeight + 1;

		if (isAtBottom && visibleCount < totalAvailableSuggestions) {
			visibleCount = visibleCount + 20;
		}
	}
</script>

<div class="relative flex w-full flex-col gap-1" use:clickOutside={closeDropdown}>
	<label for={id} class="text-gray mb-2 block text-sm font-medium">{label}</label>

	<!-- Dropdown button -->
	<button
		type="button"
		{id}
		class="group border-gray hover:bg-gray flex w-full cursor-pointer items-center justify-between rounded-sm border bg-white px-3 py-2 text-left text-black transition-colors duration-150 hover:text-white focus:outline-blue-500"
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

	<!-- Error display -->
	{#if error && errorMessage}
		<p class="mt-1 text-sm text-red-500">{errorMessage}</p>
	{:else if errors && errors.length > 0}
		<p class="mt-1 text-sm text-red-500">{errors[0]}</p>
	{/if}

	{#if showDropdown}
		<ul
			bind:this={suggestionsListElement}
			class={`absolute z-50 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white shadow-md
		${dropdownPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}
			role="listbox"
			on:keydown={handleKeydown}
			on:scroll={onSuggestionsScroll}
		>
			{#if search}
				<li class="p-2">
					<input
						type="text"
						class="focus:outline-blue w-full rounded-lg border p-2"
						placeholder="Sök..."
						bind:value={searchQuery}
						on:keydown={handleKeydown}
					/>
				</li>
			{/if}

			{#each filteredOptions as option, index}
				<li class="hover:bg-gray flex cursor-pointer items-center p-2 hover:text-white">
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
