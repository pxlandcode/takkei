<script lang="ts">
	export let label = '';
	export let goal = 0;
	export let achieved = 0;
	export let scaleMax = 1; // global max to align widths

	const MAX_PCT = 100;
	const clampPct = (n: number) => Math.max(0, Math.min(MAX_PCT, n));

	$: denom = Math.max(1, scaleMax);
	$: goalPct = clampPct((goal / denom) * 100);
	$: achievedPct = clampPct((achieved / denom) * 100);
</script>

<div class="grid grid-cols-[140px,1fr,120px] items-center gap-3">
	<div class="text-sm font-medium">{label}</div>

	<div class="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
		<!-- Goal bar -->
		<div class="absolute left-0 top-0 h-full bg-blue-300" style={`width:${goalPct}%`} />
		<!-- Achieved overlay -->
		<div class="absolute left-0 top-0 h-full bg-green-500" style={`width:${achievedPct}%`} />
	</div>

	<div class="text-right text-sm tabular-nums">
		<span class="text-green-700">{achieved}</span>
		<span class="mx-1 text-gray-400">/</span>
		<span class="text-blue-700">{goal}</span>
		<span class={achieved - goal >= 0 ? 'ml-2 text-green-600' : 'ml-2 text-red-600'}>
			({achieved - goal >= 0 ? '+' : ''}{achieved - goal})
		</span>
	</div>
</div>
