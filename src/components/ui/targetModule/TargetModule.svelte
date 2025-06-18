<script lang="ts">
	import { targetStore, updateTargets } from '$lib/stores/targetsStore';
	import { onMount } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import ProgressBar from '../../bits/progress-bar/ProgressBar.svelte';
	import { goto } from '$app/navigation';

	let userId = 19;
	let selectedDate = new Date();

	onMount(() => {
		const formattedDate = selectedDate.toISOString().slice(0, 10);
		updateTargets(userId, formattedDate);
	});
</script>

<div class="relative w-[320px] rounded-lg p-4 text-sm font-light glass">
	<!-- Header -->
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl text-white">Mål</h2>
		<Button
			small
			text="Min sida"
			variant="secondary"
			iconLeft="Person"
			iconRight="ChevronRight"
			on:click={() => goto('/')}
		/>
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
