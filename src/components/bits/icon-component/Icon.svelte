<script lang="ts">
	import type { SvelteComponent } from 'svelte';
	import * as icons from '$icons';

	export let icon: string;
	export let size: string = '40px';
	export let extraClasses: string = '';
	export let color: string = 'currentColor';

	let IconComponent: typeof SvelteComponent | null = null;

	$: IconComponent = icons[`Icon${icon}`];
	$: classString = `transition-colors duration-200 ${extraClasses}`;
</script>

{#if IconComponent}
	<svelte:component this={IconComponent} class={classString} {size} {color} />
{:else}
	<span style="display: inline-block; width: {size}; height: {size};"></span>
{/if}
