<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getCurrentTimeOffset } from '$lib/helpers/calendarHelpers/calendar-utils';

	export let startHour: number;
	export let hourHeight: number;
	export let topOffset = 0;

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
	class="bg-blue absolute right-0 left-10 z-10 flex h-[2px] items-center"
	style="top: {currentTimeOffset + topOffset}px;"
></div>
