<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip';

	export let info: string = 'Info tooltip';
	export let preferred: 'bottom' | 'top' | 'left' | 'right' = 'bottom';
	export let delay = 0;
	export let clickable = true;
	export let letter = 'i';

	// Add variant prop: "white" (default) or "dark"
	export let variant: 'white' | 'dark' = 'white';
</script>

<button
	use:tooltip={{
		content: info,
		preferred,
		delay,
		clickable
	}}
	class={`flex h-6 w-6 items-center justify-center rounded-full border 
		${variant === 'dark' ? 'border-text text-text' : 'border-white text-white'} 
		bg-transparent text-xs font-bold hover:opacity-80`}
>
	{letter}
</button>
