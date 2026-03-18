<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import { updateAchievements } from '$lib/stores/achievementsStore';
	import {
		targetMeta,
		updateTargets,
		locationTargetMeta,
		updateLocationTargets,
		companyTargetMeta,
		updateCompanyTargets
	} from '$lib/stores/targetsStore';
	import { user } from '$lib/stores/userStore';
	import HomeModernTargetProgressGroup from './HomeModernTargetProgressGroup.svelte';

	let mounted = false;
	let goalsUserId: number | null = null;

	onMount(() => {
		mounted = true;

		if ($user?.id) {
			goalsUserId = $user.id;
			loadTargets();
		}
	});

	$: if (mounted && $user?.id && $user.id !== goalsUserId) {
		goalsUserId = $user.id;
		loadTargets();
	}

	$: if (mounted && !$user?.id && goalsUserId !== null) {
		goalsUserId = null;
	}

	function loadTargets() {
		if (!$user?.id) return;

		const formattedDate = new Date().toISOString().slice(0, 10);
		void updateTargets('trainer', $user.id, formattedDate);
		void updateAchievements($user.id, formattedDate);

		const defaultLocationId = $user.kind === 'trainer' ? Number($user.default_location_id ?? 0) : 0;
		if (defaultLocationId > 0) {
			void updateLocationTargets(defaultLocationId, formattedDate);
		}

		void updateCompanyTargets(formattedDate);
	}
</script>

<section class="bg-white p-5 shadow-sm">
	<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
		<Icon icon="Trophy" size="18px" color="primary" />
		Mål
	</h2>
	<div class="space-y-4">
		{#if $targetMeta}
			<HomeModernTargetProgressGroup icon="Person" label="Mina mål" meta={$targetMeta} />
		{/if}

		{#if $locationTargetMeta && ($locationTargetMeta.yearGoal !== null || $locationTargetMeta.monthGoal !== null)}
			<HomeModernTargetProgressGroup
				icon="Building"
				label={$locationTargetMeta.locationName ?? 'Plats'}
				meta={$locationTargetMeta}
				title={$locationTargetMeta.locationName ?? 'Plats'}
			/>
		{/if}

		{#if $companyTargetMeta}
			<HomeModernTargetProgressGroup icon="Takkei" label="Takkei" meta={$companyTargetMeta} />
		{/if}
	</div>
</section>
