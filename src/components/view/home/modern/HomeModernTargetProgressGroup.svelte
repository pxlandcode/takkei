<script lang="ts">
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import ProgressCircle from '../../../bits/progress-circle/ProgressCircle.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import type { TargetMeta } from '$lib/stores/targetsStore';

	export let icon: string;
	export let label: string;
	export let meta: TargetMeta;
	export let title: string | null = null;
</script>

<div>
	<div class="mb-2 flex items-center gap-1" title={title ?? undefined}>
		<Icon {icon} size="14px" color="primary" />
		<span class="text-xs font-medium text-gray-600">{label}</span>
	</div>
	<div class="grid grid-cols-3 gap-2 text-center">
		<div use:tooltip={{ content: `Årsmål: ${meta.yearGoal ?? 0}\nUppnått: ${meta.achievedYear}` }}>
			<ProgressCircle
				value={meta.achievedYear}
				max={meta.yearGoal ?? 0}
				size={72}
				strokeWidth={6}
			/>
			<p class="mt-1 text-[10px] text-gray-400">År</p>
		</div>
		<div
			use:tooltip={{ content: `Månadsmål: ${meta.monthGoal ?? 0}\nUppnått: ${meta.achievedMonth}` }}
		>
			<ProgressCircle
				value={meta.achievedMonth}
				max={meta.monthGoal ?? 0}
				size={72}
				strokeWidth={6}
			/>
			<p class="mt-1 text-[10px] text-gray-400">Månad</p>
		</div>
		<div
			use:tooltip={{ content: `Veckomål: ${meta.weekGoal ?? 0}\nUppnått: ${meta.achievedWeek}` }}
		>
			<ProgressCircle
				value={meta.achievedWeek}
				max={meta.weekGoal ?? 0}
				size={72}
				strokeWidth={6}
			/>
			<p class="mt-1 text-[10px] text-gray-400">Vecka</p>
		</div>
	</div>
</div>
