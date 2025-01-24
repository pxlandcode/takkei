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
		const initialTimeout = setTimeout(() => {
			updateTime();
			interval = setInterval(updateTime, 60000);
		}, millisecondsUntilNextMinute);

		onDestroy(() => {
			clearTimeout(initialTimeout);
			clearInterval(interval);
		});
	});

	$: currentTimeLabel = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
</script>

<div class="absolute z-10 flex w-full items-center" style="top: {currentTimeOffset - 16}px;">
	<div
		class="relative z-20 h-8 w-20 rounded-full bg-blue px-2 py-1 text-center text-[0.9rem] font-light text-white shadow-md"
		style="left: 50%; transform: translateX(-50%);"
	>
		{currentTimeLabel}
	</div>
</div>
