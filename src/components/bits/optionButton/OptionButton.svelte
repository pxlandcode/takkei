<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../icon-component/Icon.svelte';

	export let options: { value: any; label: string; icon?: string }[] = [];
	export let selectedOption: { value: any; label: string } | null = null;
	export let variant: 'black' | 'gray' = 'gray';
	export let size: 'small' | 'medium' = 'medium';
	export let full: boolean = false;
	export let label: string = '';
	export let labelIcon: string = '';
	export let labelIconSize: string = '20px';
	export let id: string | null = null;
	export let errors: Record<string, string> = {};
	export let errorKey: string | null = null;

	let generatedId = `option-button-${Math.random().toString(36).slice(2, 9)}`;

	if (!id) {
		id = generatedId;
	}
	const dispatch = createEventDispatcher();

	$: resolvedErrorKey = errorKey ?? id ?? undefined;

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
    w-full  rounded   bg-white p-[2px]
    ${variant === 'black' ? 'border-white border-2' : '  '}
    ${variant === 'gray' ? 'border-gray border' : ''}
    ${errors[resolvedErrorKey] ? 'border-red-500' : ''}
    ${full ? '' : 'max-w-md'}`;

	$: selectedClasses = `
		${variant === 'black' ? 'bg-black text-white' : ''}
        ${variant === 'gray' ? 'bg-gray text-white' : ''}
	`;
</script>

<!-- Outer container -->
<div class="flex flex-col gap-2">
	{#if label}
		<div class="mb-1 flex flex-row items-center gap-2">
			{#if labelIcon}
				<Icon icon={labelIcon} size={labelIconSize} color="gray" />
			{/if}

			<label for={id} class="mb-1 block text-sm font-medium text-gray">{label}</label>
		</div>
	{/if}
	<div class={wrapperClasses}>
		<div {id} class="flex gap-[2px] rounded">
			{#each options as option, index}
				<button
					type="button"
					class={`${buttonClasses} ${selectedOption?.value === option.value ? selectedClasses : ''} 
					${index === 0 ? 'rounded-l' : ''} 
					${index === options.length - 1 ? 'rounded-r' : ''}`}
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
	{#if resolvedErrorKey && errors[resolvedErrorKey]}
		<p class="text-sm text-red-500">{errors[resolvedErrorKey]}</p>
	{/if}
</div>
