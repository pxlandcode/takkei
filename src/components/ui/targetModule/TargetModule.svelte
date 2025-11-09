<script lang="ts">
	import { targetStore, targetMeta, updateTargets } from '$lib/stores/targetsStore';
	import { onMount } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import ProgressBar from '../../bits/progress-bar/ProgressBar.svelte';
	import { goto } from '$app/navigation';
	import { capitalizeFirstLetter, svMonth } from '$lib/helpers/generic/genericHelpers';

	let userId = 19; // trainer id
	let selectedDate = new Date();
	let year = selectedDate.getFullYear();
	let month = capitalizeFirstLetter(svMonth(selectedDate.getMonth() + 1));

	onMount(() => {
		const formattedDate = selectedDate.toISOString().slice(0, 10);
		updateTargets('trainer', userId, formattedDate);
	});
</script>

<div class="relative w-[320px] rounded-sm p-4 text-sm font-light glass">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl text-white">Mål</h2>
		<Button
			small
			text="Min sida"
			variant="secondary"
			iconLeft="Person"
			iconRight="ChevronRight"
			on:click={() => goto('/home')}
		/>
	</div>

	<!-- Year + Month summary bars -->
	{#if $targetMeta}
		<div class="mb-3 space-y-3">
			<!-- Årsmål -->
			<div class="flex flex-col gap-1">
				<div class="flex items-baseline justify-between">
					<p class="text-white">{year}</p>
				</div>
				<ProgressBar
					icon="Running"
					textColor="white"
					value={$targetMeta.achievedYear ?? 0}
					max={$targetMeta.yearGoal ?? 0}
				/>
			</div>

			<!-- Månadsmål -->
			<div class="flex flex-col gap-1">
				<div class="flex items-baseline justify-between">
					<p class="text-white">{month}</p>
				</div>
				<ProgressBar
					icon="Running"
					textColor="white"
					value={$targetMeta.achievedMonth ?? 0}
					max={$targetMeta.monthGoal ?? 0}
				/>
			</div>
		</div>
	{/if}

	<!-- Keep the old target list (without its own progress bars for now) -->
	{#if $targetStore.length}
		<div class="mt-2 flex flex-col gap-2">
			{#each $targetStore as target}
				<div class="flex flex-col gap-1">
					<p class="text-white">{target.title}</p>
					<!-- Intentionally no ProgressBar here anymore -->
					<!-- You can add badges/details if useful -->
					<!-- <p class="text-xs text-white/50">{target.target_kind_name}</p> -->
				</div>
			{/each}
		</div>
	{/if}
</div>
