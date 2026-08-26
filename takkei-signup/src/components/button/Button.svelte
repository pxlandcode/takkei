<script lang="ts">
	export let type: 'button' | 'submit' | 'reset' = 'button';
	export let disabled: boolean = false;
	export let extraClasses: string = '';
	export let onClick: (() => void) | null = null;
</script>

<button
	{type}
	class={`rounded-sm bg-gray/40 px-3 py-2 text-sm transition-all duration-200 hover:bg-gray/60 sm:rounded-full ${extraClasses}`}
	on:click={() => onClick?.()}
	{disabled}
>
	<slot />
</button>
