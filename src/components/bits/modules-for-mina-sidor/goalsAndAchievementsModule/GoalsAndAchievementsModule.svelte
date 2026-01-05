<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';

	import {
		targetMeta,
		updateTargets,
		locationTargetMeta,
		updateLocationTargets,
		companyTargetMeta,
		updateCompanyTargets
	} from '$lib/stores/targetsStore';
	import { achievementStore, updateAchievements } from '$lib/stores/achievementsStore';

	import Icon from '../../icon-component/Icon.svelte';
	import ProgressCircle from '../../progress-circle/ProgressCircle.svelte';
	import { tooltip } from '$lib/actions/tooltip';

	let selectedDate = new Date();

	onMount(() => {
		if ($user?.id) {
			const formattedDate = selectedDate.toISOString().slice(0, 10);

			// Trainer targets
			updateTargets('trainer', $user.id, formattedDate);

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

	$: $user;
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
		<div class="grid grid-cols-4 gap-2 text-center text-xs font-medium text-gray-500">
			<div></div>
			<div>År</div>
			<div>Månad</div>
			<div>Vecka</div>
		</div>

		<!-- User Goals Row -->
		{#if $targetMeta}
			<div class="grid grid-cols-4 items-center gap-2">
				<div class="flex items-center gap-2">
					<Icon icon="Person" size="16px" color="primary" />
					<span class="truncate text-sm font-medium text-gray-700">Mina mål</span>
				</div>
				<div class="flex justify-center">
					<ProgressCircle
						value={$targetMeta.achievedYear}
						max={$targetMeta.yearGoal ?? 0}
						size={70}
						strokeWidth={6}
					/>
				</div>
				<div class="flex justify-center">
					<ProgressCircle
						value={$targetMeta.achievedMonth}
						max={$targetMeta.monthGoal ?? 0}
						size={70}
						strokeWidth={6}
					/>
				</div>
				<div class="flex justify-center">
					<ProgressCircle
						value={$targetMeta.achievedWeek}
						max={$targetMeta.weekGoal ?? 0}
						size={70}
						strokeWidth={6}
					/>
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-4 items-center gap-2">
				<div class="flex items-center gap-2">
					<Icon icon="Person" size="16px" color="primary" />
					<span class="text-sm font-medium text-gray-700">Mina mål</span>
				</div>
				<div class="col-span-3 text-center text-sm text-gray-400 italic">Hämtar...</div>
			</div>
		{/if}

		<!-- Location Goals Row -->
		{#if $locationTargetMeta && ($locationTargetMeta.yearGoal !== null || $locationTargetMeta.monthGoal !== null)}
			<div class="grid grid-cols-4 items-center gap-2">
				<div class="flex items-center gap-2">
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
						value={$locationTargetMeta.achievedYear}
						max={$locationTargetMeta.yearGoal ?? 0}
						size={70}
						strokeWidth={6}
					/>
				</div>
				<div class="flex justify-center">
					<ProgressCircle
						value={$locationTargetMeta.achievedMonth}
						max={$locationTargetMeta.monthGoal ?? 0}
						size={70}
						strokeWidth={6}
					/>
				</div>
				<div class="flex justify-center">
					<ProgressCircle
						value={$locationTargetMeta.achievedWeek}
						max={$locationTargetMeta.weekGoal ?? 0}
						size={70}
						strokeWidth={6}
					/>
				</div>
			</div>
		{/if}

		<!-- Company Goals Row -->
		{#if $companyTargetMeta}
			<div class="grid grid-cols-4 items-center gap-2">
				<div class="flex items-center gap-2">
					<Icon icon="Takkei" size="16px" color="primary" />
					<span class="truncate text-sm font-medium text-gray-700">Takkei</span>
				</div>
				<div class="flex justify-center">
					<ProgressCircle
						value={$companyTargetMeta.achievedYear}
						max={$companyTargetMeta.yearGoal ?? 0}
						size={70}
						strokeWidth={6}
					/>
				</div>
				<div class="flex justify-center">
					<ProgressCircle
						value={$companyTargetMeta.achievedMonth}
						max={$companyTargetMeta.monthGoal ?? 0}
						size={70}
						strokeWidth={6}
					/>
				</div>
				<div class="flex justify-center">
					<ProgressCircle
						value={$companyTargetMeta.achievedWeek}
						max={$companyTargetMeta.weekGoal ?? 0}
						size={70}
						strokeWidth={6}
					/>
				</div>
			</div>
		{:else}
			<div class="grid grid-cols-4 items-center gap-2">
				<div class="flex items-center gap-2">
					<Icon icon="Users" size="16px" color="primary" />
					<span class="text-sm font-medium text-gray-700">Företaget</span>
				</div>
				<div class="col-span-3 text-center text-sm text-gray-400 italic">Hämtar...</div>
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
