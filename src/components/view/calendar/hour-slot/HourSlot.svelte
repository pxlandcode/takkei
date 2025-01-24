<script lang="ts">
	export let hour: number;
	export let index: number;
	export let hourHeight: number;
	export let hideLabel: boolean;
</script>

<div
	class="relative flex items-center justify-center text-2xl font-thin text-text"
	style="height: {hourHeight}px; top: {-hourHeight / 2}px;"
>
	{#if !hideLabel}
		{hour.toString().padStart(2, '0')}
	{/if}
</div>
