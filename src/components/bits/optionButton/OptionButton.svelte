<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../icon-component/Icon.svelte';

	export let options: { value: any; label: string; icon?: string }[] = [];
	export let selectedOption: { value: any; label: string } | null = null;
	export let variant: 'black' | 'gray' = 'gray';
	export let size: 'small' | 'medium' = 'medium';
	export let full: boolean = false;

	const dispatch = createEventDispatcher();

	function selectOption(option: { value: any; label: string }) {
		selectedOption = option;
		dispatch('select', option.value);
	}

	$: buttonClasses = `
		flex-1 flex flex-row gap-1 text-center font-semibold transition-all duration-200 active:scale-90  hover:text-white items-center justify-center 
		${size === 'small' ? 'h-8 text-xs' : 'h-[46px] text-sm'} 
		${variant === 'black' ? 'text-black hover:bg-black ' : '  '}
         ${variant === 'gray' ? 'text-gray hover:bg-gray' : ''}
	`;

	$: wrapperClasses = `
    w-full  rounded-lg   bg-white p-[2px]
    ${variant === 'black' ? 'border-white border-2' : '  '}
    ${variant === 'gray' ? 'border-gray border' : ''}
    ${full ? '' : 'max-w-md'}`;

	$: selectedClasses = `
		${variant === 'black' ? 'bg-black text-white' : ''}
        ${variant === 'gray' ? 'bg-gray text-white' : ''}
	`;
</script>

<!-- Outer container -->
<div class={wrapperClasses}>
	<div class="flex gap-[2px] rounded-lg">
		{#each options as option, index}
			<button
				type="button"
				class={`${buttonClasses} ${selectedOption?.value === option.value ? selectedClasses : ''} 
					${index === 0 ? 'rounded-l-md' : ''} 
					${index === options.length - 1 ? 'rounded-r-md' : ''}`}
				on:click={() => selectOption(option)}
			>
				{#if selectedOption?.value === option.value || option.icon}
					<Icon icon={option.icon ? option.icon : 'Check'} size="16px" />
				{/if}
				{option.label}
			</button>
		{/each}
	</div>
</div>
