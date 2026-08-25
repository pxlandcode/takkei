<script lang="ts">
	import {
		targetStore,
		targetMeta,
		updateTargets,
		todayLocalISO,
		weekNumberForDate
	} from '$lib/stores/targetsStore';
	import { onMount } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import ProgressBar from '../../bits/progress-bar/ProgressBar.svelte';
	import { goto } from '$app/navigation';
	import { capitalizeFirstLetter, svMonth } from '$lib/helpers/generic/genericHelpers';
	import { user } from '$lib/stores/userStore';

	let mounted = false;
	let loadedUserId: number | null = null;
	let selectedDate = new Date();
	let month = capitalizeFirstLetter(svMonth(selectedDate.getMonth() + 1));

	let weekNumber = weekNumberForDate(selectedDate);

	onMount(() => {
		mounted = true;
		void loadTargetsForCurrentUser();
	});

	$: if (mounted && $user?.kind === 'trainer' && $user.id !== loadedUserId) {
		void loadTargetsForCurrentUser();
	}

	$: if (mounted && $user?.kind !== 'trainer' && loadedUserId !== null) {
		loadedUserId = null;
	}

	function updateDateLabels(date = new Date()) {
		selectedDate = date;
		month = capitalizeFirstLetter(svMonth(selectedDate.getMonth() + 1));
		weekNumber = weekNumberForDate(selectedDate);
	}

	async function loadTargetsForCurrentUser() {
		if ($user?.kind !== 'trainer') return;

		loadedUserId = $user.id;
		updateDateLabels();
		await updateTargets('trainer', $user.id, todayLocalISO(selectedDate));
	}
</script>

<div class="glass relative w-[320px] rounded-sm p-4 text-sm font-light">
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-xl text-white">Mina mål</h2>
		<Button
			small
			text="Min sida"
			variant="secondary"
			iconLeft="Person"
			iconRight="ChevronRight"
			on:click={() => goto('/home')}
		/>
	</div>

	<!-- Month + Week summary bars -->
	{#if $targetMeta}
		<div class="mb-3 space-y-4">
			<!-- Månadsmål -->
			<div class="flex flex-col gap-1">
				<div class="flex items-baseline justify-between">
					<p class="text-base font-medium text-white">{month}</p>
				</div>
				<ProgressBar
					textColor="white"
					value={$targetMeta.achievedMonth ?? 0}
					max={$targetMeta.monthGoal ?? 0}
				/>
			</div>

			<!-- Veckomål -->
			<div class="flex flex-col gap-1">
				<div class="flex items-baseline justify-between">
					<p class="text-base font-medium text-white">Vecka {weekNumber}</p>
				</div>
				<ProgressBar
					textColor="white"
					value={$targetMeta.achievedWeek ?? 0}
					max={$targetMeta.weekGoal ?? 0}
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
