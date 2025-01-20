<script lang="ts">
	import {
		getMeetingHeight,
		getTopOffset,
		formatTime
	} from '$lib/helpers/calendarHelpers/calendar-utils';
	import type { FullBooking } from '$lib/types/calendarTypes';

	export let booking: FullBooking;
	export let startHour: number;
	export let hourHeight: number;
	export let i: number;

	// If `endTime` does not exist, assume 1-hour duration
	$: endTime =
		booking.booking.endTime ??
		new Date(new Date(booking.booking.startTime).getTime() + 60 * 60 * 1000).toISOString();

	$: topOffset = getTopOffset(booking.booking.startTime, startHour, hourHeight);
	$: meetingHeight = getMeetingHeight(booking.booking.startTime, endTime, hourHeight);
</script>

<div
	class="absolute left-1 right-1 rounded-md p-1 text-xs text-white shadow-md"
	style="top: {topOffset}px; height: {meetingHeight}px; background-color: {i % 2 === 0
		? '#3C82F6'
		: '#c04c3d'};"
>
	<p class="font-bold">{booking.room.roomName}</p>
	<p>{formatTime(booking.booking.startTime)} - {formatTime(endTime)}</p>
	<p class="text-xs opacity-80">{booking.trainer.firstname} {booking.trainer.lastname}</p>
</div>
