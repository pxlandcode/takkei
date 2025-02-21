<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	export let size = '40px';
	export let extraClasses = '';
	export let time: string | null = null; // Allow null to use current time

	let date = new Date(time ?? new Date().toISOString());
	let hours = date.getHours();
	let minutes = date.getMinutes();

	let hourRotation = (hours % 12) * 30 + minutes * 0.5;
	let minuteRotation = minutes * 6;
	let updateInterval: number;

	// Function to update the time
	function updateTime() {
		date = new Date();
		hours = date.getHours();
		minutes = date.getMinutes();

		hourRotation = (hours % 12) * 30 + minutes * 0.5;
		minuteRotation = minutes * 6;

		// Calculate time until next minute
		const msUntilNextMinute = (60 - date.getSeconds()) * 1000;

		// Clear any previous interval
		clearTimeout(updateInterval);
		updateInterval = setTimeout(updateTime, msUntilNextMinute);
	}

	onMount(() => {
		updateTime(); // Initial update
	});

	onDestroy(() => {
		clearTimeout(updateInterval);
	});

	$: classString = `${extraClasses}`;
</script>

<svg
	width={size}
	height={size}
	class={classString}
	fill="currentColor"
	viewBox="0 0 40 40"
	xmlns="http://www.w3.org/2000/svg"
>
	<circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="4.5" fill="none" />

	<line
		x1="20"
		y1="20"
		x2="20"
		y2="10"
		stroke="currentColor"
		stroke-width="4.5"
		transform="rotate({hourRotation}, 20, 20)"
	/>

	<line
		x1="20"
		y1="20"
		x2="20"
		y2="8"
		stroke="currentColor"
		stroke-width="4.5"
		transform="rotate({minuteRotation}, 20, 20)"
	/>
</svg>

<style>
	svg {
		transition: transform 0.2s ease-in-out;
	}
</style>
