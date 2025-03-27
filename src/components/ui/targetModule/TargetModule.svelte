<script lang="ts">
	import { targetStore, updateTargets } from '$lib/stores/targetsStore';
	import { onMount } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import ProgressBar from '../../bits/progress-bar/ProgressBar.svelte';

	let userId = 19; // Replace with actual user ID
	let selectedDate = new Date();

	// Fetch targets on mount
	onMount(() => {
		const formattedDate = selectedDate.toISOString().slice(0, 10);
		updateTargets(userId, formattedDate);
	});

	console.log($targetStore);
</script>

<div class="relative w-[320px] rounded-lg p-4 text-sm font-light glass">
	<!-- Header -->
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl text-white">Mål</h2>
		<Button small text="Min sida" variant="secondary" iconLeft="Person" iconRight="ChevronRight" />
	</div>

	<!-- Targets List -->
	<div class="flex flex-col gap-4">
		{#each $targetStore as target}
			<div class="flex flex-col gap-2">
				<p class="text-white">{target.title}</p>
				<ProgressBar icon="Running" value={target.achieved} max={target.target} />
			</div>
		{/each}
	</div>
</div>

<style>
</style>
