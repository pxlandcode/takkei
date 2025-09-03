<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';

	// Stores (new targets use `targetMeta`)
	import { targetMeta, updateTargets } from '$lib/stores/targetsStore';
	import { achievementStore, updateAchievements } from '$lib/stores/achievementsStore';

	// Components
	import Icon from '../../icon-component/Icon.svelte';
	import ProgressBar from '../../progress-bar/ProgressBar.svelte';
	import { tooltip } from '$lib/actions/tooltip';

	// Month label helper (your unified version that handles 0/1-based and "09")
	import { svMonth } from '$lib/helpers/generic/genericHelpers';

	let selectedDate = new Date();

	onMount(() => {
		if ($user?.id) {
			const formattedDate = selectedDate.toISOString().slice(0, 10);
			// NEW: pass ownerType explicitly
			updateTargets('trainer', $user.id, formattedDate);
			updateAchievements($user.id, formattedDate);
		}
	});

	$: $user;
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-md">
	<!-- Header -->
	<div class="mb-4 flex items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<div class="flex h-6 w-6 items-center justify-center rounded-full bg-text text-white">
				<Icon icon="Trophy" size="14px" />
			</div>
			<h3 class="text-lg font-semibold text-text">Mål & utmärkelser</h3>
		</div>
	</div>

	<!-- Goals (from targetMeta: year/month goals + achieved) -->
	{#if $targetMeta}
		<div class="mb-4 flex flex-col gap-4">
			<!-- Årsmål -->
			<div class="flex flex-col gap-1">
				<div class="flex items-baseline justify-between">
					<p class="text-sm font-medium text-gray-700">
						Mål {$targetMeta.year ?? selectedDate.getFullYear()}
					</p>
				</div>
				<ProgressBar
					iconColor="text"
					textColor="text"
					icon="Running"
					value={$targetMeta.achievedYear ?? 0}
					max={$targetMeta.yearGoal ?? 0}
				/>
			</div>

			<!-- Månadsmål -->
			<div class="flex flex-col gap-1">
				<div class="flex items-baseline justify-between">
					<p class="text-sm font-medium text-gray-700">
						Mål {svMonth($targetMeta.month ?? selectedDate.getMonth())}
					</p>
				</div>
				<ProgressBar
					iconColor="text"
					textColor="text"
					icon="Running"
					value={$targetMeta.achievedMonth ?? 0}
					max={$targetMeta.monthGoal ?? 0}
				/>
			</div>
		</div>
	{:else}
		<!-- Fallback if meta hasn’t loaded -->
		<p class="mb-4 text-sm italic text-gray-500">Hämtar mål …</p>
	{/if}

	<!-- Achievements (unchanged) -->
	{#if $achievementStore.length > 0}
		<div class="grid grid-cols-4 gap-4 text-center">
			{#each $achievementStore as achievement}
				<div
					use:tooltip={{ content: achievement?.description }}
					class="flex flex-col items-center gap-2"
				>
					<div
						class="relative flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400 shadow-sm transition hover:scale-105"
					>
						<span class="text-xl">🏆</span>
						<span
							class="absolute bottom-[-6px] right-[-6px] rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] text-white shadow"
						>
							x{achievement.achieved}
						</span>
					</div>
					<p class="text-xs font-medium text-gray-700">{achievement.title}</p>
				</div>
			{/each}
		</div>
	{:else}
		<p class="text-sm italic text-gray-500">Inga utmärkelser ännu.</p>
	{/if}
</div>
