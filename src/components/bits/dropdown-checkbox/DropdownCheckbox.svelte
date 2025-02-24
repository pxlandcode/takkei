<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Checkbox from '../checkbox/Checkbox.svelte';
	import { clickOutside } from '$lib/actions/clickOutside';

	export let id: string;
	export let label: string;
	export let placeholder: string;
	export let selectedValues: any[] = [];
	export let options: { name: string; value: any }[] = [];
	export let disabled: boolean = false;
	export let error: boolean = false;
	export let errorMessage: string = '';
	export let errors: string[] | undefined = undefined;
	export let extraWrapperClasses: string = '';
	export let isDropdown: boolean = false;
	export let maxNumberOfSuggestions: number | undefined = undefined;
	export let infiniteScroll: boolean = false;

	const dispatch = createEventDispatcher();
	let showSuggestions = false;
	let wrapperElement: HTMLElement;
	let activeIndex = -1;
	let searchQuery = '';
	let initialMaxNumberOfSuggestions = maxNumberOfSuggestions;
	let suggestionsListElement: HTMLUListElement;
	let totalAvailableSuggestions = options.length;

	$: filteredOptions = options
		.filter((option) => option.name.toLowerCase().includes(searchQuery.toLowerCase()))
		.slice(0, maxNumberOfSuggestions);

	function toggleDropdown(event?: MouseEvent) {
		event?.stopPropagation();
		showSuggestions = !showSuggestions;
		if (showSuggestions) activeIndex = 0;
	}

	function closeDropdown() {
		showSuggestions = false;
		activeIndex = -1;
	}

	function handleCheckboxChange(optionValue: any, checked: boolean) {
		let updatedSelection;
		if (checked) {
			updatedSelection = [...selectedValues, optionValue];
		} else {
			updatedSelection = selectedValues.filter((v) => v !== optionValue);
		}
		dispatch('change', { selected: updatedSelection });
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!showSuggestions) {
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

	function onSuggestionsScroll() {
		if (!infiniteScroll || !maxNumberOfSuggestions) return;

		const { scrollTop, scrollHeight, clientHeight } = suggestionsListElement;
		const isAtBottom = scrollHeight - scrollTop === clientHeight;

		if (isAtBottom && maxNumberOfSuggestions < totalAvailableSuggestions) {
			maxNumberOfSuggestions += 20;
		}
	}
</script>

<div
	bind:this={wrapperElement}
	class={`relative flex w-full flex-col gap-1 ${extraWrapperClasses} `}
	use:clickOutside={closeDropdown}
>
	<label for={id} class="text-blue-dark block text-base font-medium">
		{label}
	</label>
	<div class="flex items-center">
		<input
			type="text"
			{id}
			class="block w-full rounded-lg border p-2 shadow-sm focus:outline-blue sm:text-sm"
			{placeholder}
			bind:value={searchQuery}
			on:click|stopPropagation={toggleDropdown}
			on:keydown={handleKeyDown}
		/>
	</div>
	{#if error && errorMessage}
		<p class="text-error text-sm">{errorMessage}</p>
	{/if}
	{#if errors && errors.length > 0}
		<p class="text-error text-sm">{errors[0]}</p>
	{/if}

	{#if showSuggestions}
		<ul
			bind:this={suggestionsListElement}
			class="absolute top-[4.5rem] z-40 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white shadow-md"
			on:scroll={onSuggestionsScroll}
		>
			{#each filteredOptions as option, index}
				<li
					class="flex cursor-pointer items-center p-2 hover:bg-gray hover:text-white {index ===
					activeIndex
						? 'bg-gray text-white'
						: ''}"
				>
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
