<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../icon-component/Icon.svelte';
	import { confirm } from '$lib/actions/confirm';
	import { cancelConfirm } from '$lib/actions/cancelConfirm';

	// Props
	export let type: 'button' | 'submit' | 'reset' = 'button';
	export let text: string = '';
	export let icon: string | null = null;
	export let iconLeft: string | null = null;
	export let iconRight: string | null = null;
	export let variant: 'primary' | 'secondary' | 'cancel' | 'danger-outline' = 'primary';
	export let transparent: boolean = false;
	export let small: boolean = false;
	export let iconRightSize: string = '20px';
	export let iconLeftSize: string = '24px';
	export let iconSize: string = '20px';
	export let full: boolean = false;
	export let iconColor: string = 'currentColor';
	export let notificationCount: number = 0;
	export let disabled: boolean = false;
	export let confirmOptions: {
		title?: string;
		description?: string;
		action?: () => void;
		actionLabel?: string;
	} | null = null;
export let cancelConfirmOptions: {
	onConfirm: (reason: string, time: string, emailBehavior: 'send' | 'edit' | 'none') => void;
	startTimeISO: string;
	defaultEmailBehavior?: 'send' | 'edit' | 'none';
} | null = null;

	const dispatch = createEventDispatcher();

	// Handle click event
	function handleClick() {
		dispatch('click');
	}

	// Dynamic class setup
	$: buttonClasses = `
		flex items-center justify-center gap-2 rounded-md shadow-xs transition-all duration-200 cursor-pointer
		${variant === 'primary' ? 'bg-primary text-white hover:bg-primary-hover border border-gray/30' : ''}
		${variant === 'secondary' ? 'bg-white text-gray border border-gray hover:bg-white/80' : ''}
		${variant === 'cancel' ? 'bg-error text-white hover:bg-error-hover' : ''}
		${variant === 'danger-outline' ? 'bg-white text-error border border-gray hover:bg-error/10 hover:text-error-hover' : ''}
		${transparent ? 'bg-transparent text-gray shadow-none hover:bg-gray hover:text-white' : ''}
		${transparent && variant === 'cancel' ? 'hover:text-red' : ''}
		${icon && !text ? (small ? 'h-8 w-8' : 'h-[45px] w-[45px]') : 'p-2'}
        ${!icon && text ? (small ? 'text-sm' : 'h-[45px]') : 'text-base'}
        ${full ? 'w-full' : ''}
		focus:outline-hidden active:translate-y-1 active:scale-95 active:shadow-xs
        disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none
	`;
</script>

<div class="relative inline-block">
	{#if confirmOptions}
		<button
			aria-disabled={disabled}
			{disabled}
			use:confirm={confirmOptions}
			{type}
			class={buttonClasses}
		>
			{#if icon && !text}
				<Icon {icon} size={iconSize} color={iconColor} />
			{:else}
				{#if iconLeft}
					<Icon icon={iconLeft} size={small ? '15px' : iconLeftSize} color={iconColor} />
				{/if}
				{text}
				{#if iconRight}
					<Icon icon={iconRight} size={small ? '15px' : iconRightSize} color={iconColor} />
				{/if}
			{/if}
		</button>
	{:else if cancelConfirmOptions}
		<button
			aria-disabled={disabled}
			{disabled}
			use:cancelConfirm={cancelConfirmOptions}
			{type}
			class={buttonClasses}
		>
			{#if icon && !text}
				<Icon {icon} size={iconSize} color={iconColor} />
			{:else}
				{#if iconLeft}
					<Icon icon={iconLeft} size={small ? '15px' : iconLeftSize} color={iconColor} />
				{/if}
				{text}
				{#if iconRight}
					<Icon icon={iconRight} size={small ? '15px' : iconRightSize} color={iconColor} />
				{/if}
			{/if}
		</button>
	{:else}
		<button aria-disabled={disabled} {disabled} {type} class={buttonClasses} on:click={handleClick}>
			{#if icon && !text}
				<Icon {icon} size={iconSize} color={iconColor} />
			{:else}
				{#if iconLeft}
					<Icon icon={iconLeft} size={small ? '15px' : iconLeftSize} color={iconColor} />
				{/if}
				{text}
				{#if iconRight}
					<Icon icon={iconRight} size={small ? '15px' : iconRightSize} color={iconColor} />
				{/if}
			{/if}
		</button>
	{/if}
	{#if notificationCount > 0}
		<span
			class="bg-notification absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold text-white"
		>
			{notificationCount}
		</span>
	{/if}
</div>
