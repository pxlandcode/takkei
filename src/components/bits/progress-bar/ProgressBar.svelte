<script lang="ts">
	import Icon from '../icon-component/Icon.svelte';

	export let value: number = 0;
	export let max: number = 100;
	export let icon: string = '';
	export let iconColor: string = 'white';

	$: progress = max > 0 ? Math.min(100, (value / max) * 100) : 0;
</script>

<div class="relative flex w-full items-center text-sm text-white">
	<p>{value}</p>

	<div class="relative mx-2 h-[3px] flex-1 bg-black/50">
		<div
			class="absolute inset-y-0 left-0 bg-orange transition-all duration-500"
			style="width: {progress}%"
		></div>

		<div class="absolute -translate-y-1/2 transform" style="left: calc({progress}% - 0.5rem);">
			{#if icon}
				<Icon {icon} color={iconColor} size="20px" />
			{/if}
		</div>
	</div>

	<p>{max}</p>
</div>

<style>
</style>
