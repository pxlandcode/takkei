<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';

	import {
		locationTargetMeta,
		updateLocationTargets,
		companyTargetMeta,
		updateCompanyTargets,
		todayLocalISO,
		targetMonthLabel,
		targetWeekLabel
	} from '$lib/stores/targetsStore';
	import { achievementStore, updateAchievements } from '$lib/stores/achievementsStore';

	import Icon from '../../icon-component/Icon.svelte';
	import ProgressCircle from '../../progress-circle/ProgressCircle.svelte';
	import { tooltip } from '$lib/actions/tooltip';

	let selectedDate = new Date();

	$: monthLabel = targetMonthLabel(selectedDate.getMonth() + 1);
	$: weekLabel = targetWeekLabel(todayLocalISO(selectedDate), selectedDate);

	onMount(() => {
		if ($user?.id) {
			const formattedDate = todayLocalISO(selectedDate);

			// Achievements
			updateAchievements($user.id, formattedDate);

			// Location targets (only if user has a default location)
			const defaultLocationId =
				$user.kind === 'trainer' ? Number($user.default_location_id ?? 0) : 0;
			if (defaultLocationId > 0) {
				updateLocationTargets(defaultLocationId, formattedDate);
			}

			// Company-wide targets
			updateCompanyTargets(formattedDate);
		}
	});
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-md">
	<!-- Header -->
	<div class="mb-4 flex items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<div class="bg-text flex h-6 w-6 items-center justify-center rounded-full text-white">
				<Icon icon="Trophy" size="14px" />
			</div>
			<h3 class="text-text text-lg font-semibold">Mål & utmärkelser</h3>
		</div>
	</div>

	<!-- Goals Grid -->
	<div class="mb-6 space-y-4">
		<!-- Header Row -->
		<div class="grid grid-cols-3 gap-3 text-center text-sm font-semibold text-gray-600">
			<div></div>
			<div>{monthLabel}</div>
			<div>{weekLabel}</div>
		</div>

		<!-- Location Goals Row -->
		{#if $locationTargetMeta && ($locationTargetMeta.monthGoal !== null || $locationTargetMeta.weekGoal !== null)}
			<div class="grid grid-cols-3 items-center gap-3">
				<div class="flex min-w-0 items-center gap-2">
					<Icon icon="Building" size="16px" color="primary" />
					<span
						class="truncate text-sm font-medium text-gray-700"
						title={$locationTargetMeta.locationName ?? 'Plats'}
					>
						{$locationTargetMeta.locationName ?? 'Plats'}
					</span>
				</div>
				<div class="flex justify-center">
					<ProgressCircle
						value={$locationTargetMeta.achievedMonth}
						max={$locationTargetMeta.monthGoal ?? 0}
						size={90}
						strokeWidth={8}
					/>
				</div>
				<div class="flex justify-center">
					<ProgressCircle
						value={$locationTargetMeta.achievedWeek}
						max={$locationTargetMeta.weekGoal ?? 0}
						size={90}
						strokeWidth={8}
					/>
				</div>
			</div>
		{/if}

		<!-- Company Goals Row -->
		{#if $companyTargetMeta}
			<div class="grid grid-cols-3 items-center gap-3">
				<div class="flex min-w-0 items-center gap-2">
					<Icon icon="Takkei" size="16px" color="primary" />
					<span class="truncate text-sm font-medium text-gray-700">Takkei</span>
				</div>
				<div class="flex justify-center">
					<ProgressCircle
						value={$companyTargetMeta.achievedMonth}
						max={$companyTargetMeta.monthGoal ?? 0}
						size={90}
						strokeWidth={8}
					/>
				</div>
				<div class="flex justify-center">
					<ProgressCircle
						value={$companyTargetMeta.achievedWeek}
						max={$companyTargetMeta.weekGoal ?? 0}
						size={90}
						strokeWidth={8}
					/>
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-3 items-center gap-3">
				<div class="flex min-w-0 items-center gap-2">
					<Icon icon="Takkei" size="16px" color="primary" />
					<span class="truncate text-sm font-medium text-gray-700">Takkei</span>
				</div>
				<div class="col-span-2 text-center text-sm text-gray-400 italic">Hämtar...</div>
			</div>
		{/if}
	</div>

	<!-- Achievements -->
	{#if $achievementStore.length > 0}
		<div class="border-t border-gray-100 pt-4">
			<h4 class="mb-3 text-sm font-medium text-gray-600">Utmärkelser</h4>
			<div class="grid grid-cols-4 gap-4 text-center">
				{#each $achievementStore as achievement}
					<div
						use:tooltip={{ content: achievement?.description ?? achievement?.title ?? '' }}
						class="flex flex-col items-center gap-2"
					>
						<div
							class="relative flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400 shadow-xs transition hover:scale-105"
						>
							<span class="text-xl">🏆</span>
							<span
								class="absolute right-[-6px] bottom-[-6px] rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] text-white shadow-sm"
							>
								x{achievement.achieved}
							</span>
						</div>
						<p class="text-xs font-medium text-gray-700">
							{achievement.title ?? achievement.name ?? 'Utmärkelse'}
						</p>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="border-t border-gray-100 pt-4">
			<p class="text-sm text-gray-500 italic">Inga utmärkelser ännu.</p>
		</div>
	{/if}
</div>
