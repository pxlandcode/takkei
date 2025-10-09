<script lang="ts">
	import type { ComponentType, SvelteComponent } from 'svelte';
	import { onDestroy } from 'svelte';

	export let component: ComponentType;
	export let props: Record<string, unknown> = {};
	export let listeners: Record<string, (event: CustomEvent<any>) => void> = {};

	let componentRef: SvelteComponent | null = null;
	let unsubs: Array<() => void> = [];

	function bindListeners() {
		if (!componentRef) return;
		unsubs.forEach((teardown) => teardown());
		unsubs = Object.entries(listeners ?? {}).map(([eventName, handler]) =>
			componentRef!.$on(eventName, handler)
		);
	}

	$: bindListeners();

	onDestroy(() => {
		unsubs.forEach((teardown) => teardown());
		unsubs = [];
	});
</script>

<svelte:component this={component} bind:this={componentRef} {...props} />
