<script lang="ts">
	import {
		getMeetingHeight,
		getTopOffset,
		formatTime
	} from '$lib/helpers/calendarHelpers/calendar-utils';
	import { getShortAddress } from '$lib/helpers/locationHelpers/location-utils';
	import { getLocationColor } from '$lib/helpers/locationHelpers/locationColors';
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

	// Get color based on locationId
	console.log('booking', booking);
	$: bookingColor = getLocationColor(booking?.location?.id);
</script>

<div
	class="absolute left-1 right-1 z-20 rounded-md border border-dashed bg-white p-1 text-xs shadow-sm"
	style="top: {topOffset}px; height: {meetingHeight -
		4}px; color: {bookingColor}; border-color: {bookingColor};"
>
	<div class="flex flex-row gap-1">
		<div class="h-8 w-8 rounded-sm opacity-20" style=" background-color: {bookingColor};"></div>
		<div class="flex flex-col">
			<p>{getShortAddress(booking.location.name)}</p>
			<p>{formatTime(booking.booking.startTime)} - {formatTime(endTime)}</p>
		</div>
	</div>
	<p>{booking.trainer.firstname} {booking.trainer.lastname}</p>
</div>
