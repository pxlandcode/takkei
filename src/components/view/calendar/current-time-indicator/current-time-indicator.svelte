<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getCurrentTimeOffset } from '$lib/helpers/calendarHelpers/calendar-utils';

	export let startHour: number;
	export let hourHeight: number;

	let currentTime = new Date();
	let currentTimeOffset = getCurrentTimeOffset(startHour, hourHeight);

	function updateTime() {
		currentTime = new Date();
		currentTimeOffset = getCurrentTimeOffset(startHour, hourHeight);
	}

	const millisecondsUntilNextMinute =
		60000 - (currentTime.getSeconds() * 1000 + currentTime.getMilliseconds());

	let interval: NodeJS.Timeout;

	onMount(() => {
		// Initial update at the start of the next minute
		const initialTimeout = setTimeout(() => {
			updateTime();
			interval = setInterval(updateTime, 60000);
		}, millisecondsUntilNextMinute);

		onDestroy(() => {
			clearTimeout(initialTimeout);
			clearInterval(interval);
		});
	});
</script>

<div
	class="absolute z-10 ml-10 flex h-[2px] w-full items-center bg-blue"
	style="top: {currentTimeOffset}px;"
></div>
