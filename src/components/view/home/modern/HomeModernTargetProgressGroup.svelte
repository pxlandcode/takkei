<script lang="ts">
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import ProgressCircle from '../../../bits/progress-circle/ProgressCircle.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { targetMonthLabel, targetWeekLabel, type TargetMeta } from '$lib/stores/targetsStore';

	export let icon: string;
	export let label: string;
	export let meta: TargetMeta;
	export let title: string | null = null;

	$: monthLabel = targetMonthLabel(meta.month);
	$: weekLabel = targetWeekLabel(meta.weekStart);
</script>

<div>
	<div class="mb-2 flex items-center gap-1" title={title ?? undefined}>
		<Icon {icon} size="14px" color="primary" />
		<span class="text-xs font-medium text-gray-600">{label}</span>
	</div>
	<div class="grid grid-cols-2 justify-items-center gap-3 text-center">
		<div
			use:tooltip={{ content: `Månadsmål: ${meta.monthGoal ?? 0}\nUppnått: ${meta.achievedMonth}` }}
		>
			<ProgressCircle
				value={meta.achievedMonth}
				max={meta.monthGoal ?? 0}
				size={92}
				strokeWidth={8}
			/>
			<p class="mt-2 text-sm font-medium text-gray-500">{monthLabel}</p>
		</div>
		<div
			use:tooltip={{ content: `Veckomål: ${meta.weekGoal ?? 0}\nUppnått: ${meta.achievedWeek}` }}
		>
			<ProgressCircle
				value={meta.achievedWeek}
				max={meta.weekGoal ?? 0}
				size={92}
				strokeWidth={8}
			/>
			<p class="mt-2 text-sm font-medium text-gray-500">{weekLabel}</p>
		</div>
	</div>
</div>
