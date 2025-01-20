<script lang="ts">
	import { getCurrentTimeOffset } from '$lib/helpers/calendarHelpers/calendar-utils';

	export let startHour: number;
	export let hourHeight: number;

	let currentTime = new Date();
	let currentTimeOffset = getCurrentTimeOffset(startHour, hourHeight);

	setInterval(() => {
		currentTime = new Date();
		currentTimeOffset = getCurrentTimeOffset(startHour, hourHeight);
	}, 60000);
</script>

<div class="absolute z-10 w-full" style="top: {currentTimeOffset}px;">
	<div class="h-[2px] w-full bg-red-500"></div>
	<div class="absolute left-0 rounded bg-red-500 px-2 py-1 text-[10px] text-white shadow">
		{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
	</div>
</div>
