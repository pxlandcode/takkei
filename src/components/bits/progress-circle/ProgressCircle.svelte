<script lang="ts">
	export let value: number = 0;
	export let max: number = 100;
	export let size: number = 80;
	export let strokeWidth: number = 8;
	export let label: string = '';

	// Colors
	const primaryColor = '#dd890b'; // orange primary
	const trackColor = '#e5e7eb'; // gray-200
	const successColor = '#24A691'; // green

	$: progress = max > 0 ? Math.min(1, value / max) : 0;
	$: isComplete = value >= max && max > 0;
	$: activeColor = isComplete ? successColor : primaryColor;

	// SVG calculations
	$: radius = (size - strokeWidth) / 2;
	$: circumference = 2 * Math.PI * radius;
	$: strokeDashoffset = circumference * (1 - progress);
	$: viewBox = `0 0 ${size} ${size}`;
	$: center = size / 2;

	// Text sizing
	$: valueFontSize = size * 0.28;
	$: maxFontSize = size * 0.14;
</script>

<div class="flex flex-col items-center gap-1">
	<div class="relative" style="width: {size}px; height: {size}px;">
		<svg {viewBox} class="rotate-[-90deg]">
			<!-- Background track -->
			<circle
				cx={center}
				cy={center}
				r={radius}
				fill="none"
				stroke={trackColor}
				stroke-width={strokeWidth}
			/>
			<!-- Progress arc -->
			<circle
				cx={center}
				cy={center}
				r={radius}
				fill="none"
				stroke={activeColor}
				stroke-width={strokeWidth}
				stroke-linecap="round"
				stroke-dasharray={circumference}
				stroke-dashoffset={strokeDashoffset}
				class="transition-all duration-500"
			/>
		</svg>
		<!-- Center text -->
		<div class="absolute inset-0 flex flex-col items-center justify-center">
			<span class="font-semibold text-gray-800" style="font-size: {valueFontSize}px;">
				{value}
			</span>
			<span class="text-gray-500" style="font-size: {maxFontSize}px;">
				/{max}
			</span>
		</div>
	</div>
	{#if label}
		<span class="text-xs font-medium text-gray-600">{label}</span>
	{/if}
</div>
