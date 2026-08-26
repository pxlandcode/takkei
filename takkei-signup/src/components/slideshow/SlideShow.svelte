<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	export let slides: Slide[] = [];
	export let intervalTime: number = 10000;

	interface Slide {
		image: string;
		lines: string[];
	}

	let currentSlide = 0;
	let interval: NodeJS.Timer | undefined;

	onMount(() => {
		interval = setInterval(() => {
			currentSlide = (currentSlide + 1) % slides.length;
		}, intervalTime);

		return () => {
			if (interval) clearInterval(interval);
		};
	});
</script>

<div class="relative h-full w-full overflow-hidden">
	{#each slides as slide, i}
		{#if currentSlide === i}
			<div class="absolute left-0 top-0 h-full w-full" transition:fade>
				<img src={slide.image} alt="Slide image" class="h-full w-full object-cover" />
				<div class="absolute bottom-12 left-8 flex flex-col gap-2 space-y-1 text-5xl text-white">
					{#each slide.lines as line}
						<p>{line}</p>
					{/each}
				</div>
			</div>
		{/if}
	{/each}
</div>

<style>
</style>
