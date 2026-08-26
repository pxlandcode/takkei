<script lang="ts">
    import type { SvelteComponent } from 'svelte';
    import * as icons from '$icons';

    export let icon: string;
    export let size: string = '40px';
    export let extraClasses: string = '';

    let IconComponent: typeof SvelteComponent | null = null;

    IconComponent = icons[`Icon${icon}`];
    $: classString = `transition-colors duration-200 ${extraClasses}`;
</script>

{#if IconComponent}
    <svelte:component this={IconComponent} class={classString} {size} color="currentColor" />
{:else}
    <span class="text-red-500">Icon not found</span>
{/if}
