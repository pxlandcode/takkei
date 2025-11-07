<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { getMeetingHeight, getTopOffset } from '$lib/helpers/calendarHelpers/calendar-utils';

	import { IconTraining, IconShiningStar, IconGraduationCap, IconPlane } from '$lib/icons';

	import type { FullBooking } from '$lib/types/calendarTypes';
	import { user } from '$lib/stores/userStore';
	import IconWrench from '$icons/IconWrench.svelte';

	type Props = {
		booking: FullBooking;
		startHour: number;
		hourHeight: number;
		toolTipText?: string;
		columnIndex?: number;
		columnCount?: number;
		onbookingselected: (event: MouseEvent) => void;
	};

	let {
		booking,
		startHour,
		hourHeight,
		toolTipText,
		columnIndex = 0,
		columnCount = 1,
		onbookingselected
	}: Props = $props();

	let bookingSlot: HTMLButtonElement | undefined = $state();
	let trainerNameElement: HTMLSpanElement | undefined = $state();
	let clientNameElement: HTMLSpanElement | undefined = $state();
	let width = $state(200);
	let useInitials = $state(false);
	let debounceTimer: NodeJS.Timeout;
	let showIcon = $state(true);

	const endTime = $derived(
		booking.booking.endTime ??
			new Date(new Date(booking.booking.startTime).getTime() + 60 * 60 * 1000).toISOString()
	);

	const topOffset = $derived(getTopOffset(booking.booking.startTime, startHour, hourHeight));
	const meetingHeight = $derived(getMeetingHeight(booking.booking.startTime, endTime, hourHeight));
	const bookingColor = $derived(booking.location?.color ?? '#000000');

	const colWidth = $derived(100 / columnCount);
	const colLeft = $derived(columnIndex * colWidth);

	const trainerInitials = $derived(
		booking.trainer?.firstname && booking.trainer?.lastname
			? `${booking.trainer.firstname[0]}${booking.trainer.lastname[0]}`
			: booking.isPersonalBooking
				? 'P'
				: 'T'
	);
	const clientInitials = $derived(
		booking.client?.firstname && booking.client?.lastname
			? `${booking.client.firstname[0]}${booking.client.lastname[0]}`
			: 'C'
	);

	// $: colWidth = 100 / columnCount;
	// $: colLeft = columnIndex * colWidth;

	const bookingIcon = $derived.by(() => {
		if (booking.booking.tryOut) return IconShiningStar;
		if (booking.booking.internalEducation) return IconWrench;
		if (booking.additionalInfo?.education) return IconGraduationCap;
		if (booking.additionalInfo?.internal) return IconPlane;
		return IconTraining;
	});

	let fullNameWidth = $state(0);
	$inspect({ fullNameWidth });
	$inspect({ useInitials });

	async function measureFullNameWidth() {
		await tick();
		requestAnimationFrame(() => {
			if (!trainerNameElement || !clientNameElement) return;
			useInitials = false;
			if (clientNameElement.offsetWidth > trainerNameElement.offsetWidth) {
				fullNameWidth = clientNameElement.offsetWidth;
			} else {
				fullNameWidth = trainerNameElement.offsetWidth;
			}

			checkNameWidth();
		});
	}
	function checkNameWidth() {
		if (!bookingSlot) return;

		const containerWidth = bookingSlot.offsetWidth;

		const namePadding = 44;
		useInitials = fullNameWidth > containerWidth - namePadding;

		showIcon = fullNameWidth < containerWidth;
	}

	onMount(async () => {
		await tick(); // Ensure DOM elements are rendered

		measureFullNameWidth();

		const resizeObserver = new ResizeObserver(() => {
			if (debounceTimer) clearTimeout(debounceTimer);

			debounceTimer = setTimeout(() => {
				width = bookingSlot?.offsetWidth || 200;
				checkNameWidth();
			}, 100);
		});

		if (bookingSlot) {
			resizeObserver.observe(bookingSlot);
		}

		return () => {
			resizeObserver.disconnect();
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});
</script>

<button
	bind:this={bookingSlot}
	on:click={onbookingselected}
	class="text-gray absolute z-20 flex cursor-pointer flex-col gap-[2px] p-1 text-xs shadow-xs {showIcon
		? 'items-start'
		: 'items-center'} {booking.trainer?.id === $user?.id
		? 'border-2'
		: ''} {booking.isPersonalBooking
		? booking.additionalInfo?.bookingContent.kind === 'Private'
			? 'bg-gray-400/20'
			: 'bg-gray-600/20'
		: ''}"
	style:top={`${topOffset}px`}
	style:height={`${meetingHeight - 4}px`}
	style:left={`calc(${colLeft}% + 2px)`}
	style:width={`calc(${colWidth}% - 4px)`}
	style:background-color={!booking.isPersonalBooking ? `${bookingColor}20` : null}
	style:border-color={!booking.isPersonalBooking ? bookingColor : null}
	use:tooltip={{ content: toolTipText }}
>
	{#if !booking.isPersonalBooking}
		<div class="flex flex-row">
			<div
				class="relative flex items-center justify-center gap-2 rounded-xs px-1"
				style="color: {bookingColor}"
			>
				{#if showIcon}
					<svelte:component this={bookingIcon} size="20px" extraClasses="relative z-10" />
				{/if}

				<div class="flex flex-row text-xs">
					<div class="flex flex-col gap-1 text-left whitespace-nowrap">
						<p class="" bind:this={trainerNameElement}>
							{useInitials
								? trainerInitials
								: `${booking.trainer.firstname} ${booking.trainer.lastname}`}
						</p>
						<p bind:this={clientNameElement}>
							{useInitials
								? clientInitials
								: `${booking.client?.firstname} ${booking.client?.lastname}`}
						</p>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex flex-row items-center text-xs">
			<p>{booking.personalBooking.name}</p>
		</div>
	{/if}
</button>
