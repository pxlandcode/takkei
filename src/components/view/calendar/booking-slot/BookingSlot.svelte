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

	type NameDisplayMode = 'full' | 'last' | 'initials';
	type NameStrings = {
		trainerFull: string;
		trainerLast: string;
		participantFull: string;
		participantLast: string;
	};

	let bookingSlot: HTMLButtonElement | undefined = $state();
	let trainerNameElement: HTMLParagraphElement | undefined = $state();
	let clientNameElement: HTMLParagraphElement | undefined = $state();
	let trainerDisplayMode = $state<NameDisplayMode>('full');
	let participantDisplayMode = $state<NameDisplayMode>('full');
	let debounceTimer: NodeJS.Timeout;
	let showIcon = $state(true);
	const ICON_SPACE = 32;
	const isBrowser = typeof window !== 'undefined';
	let textMeasureCtx: CanvasRenderingContext2D | null = null;
	let trainerFullWidth = $state(0);
	let trainerLastWidth = $state(0);
	let trainerInitialWidth = $state(0);
	let participantFullWidth = $state(0);
	let participantLastWidth = $state(0);
	let participantInitialWidth = $state(0);
	let isMounted = false;

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
	function isTraineeParticipant() {
		return (
			!booking.isPersonalBooking &&
			(booking.booking.internalEducation || booking.additionalInfo?.education)
		);
	}

	function getParticipant(): { firstname?: string | null; lastname?: string | null } | null {
		if (booking.isPersonalBooking) return null;
		return isTraineeParticipant() ? booking.trainee ?? null : booking.client ?? null;
	}

	function getTrainerLastName() {
		const last = booking.trainer?.lastname?.trim();
		if (last) return last;
		const first = booking.trainer?.firstname?.trim();
		return first ?? '';
	}

	function getTrainerDisplay() {
		const first = booking.trainer?.firstname?.trim() ?? '';
		const last = booking.trainer?.lastname?.trim() ?? '';
		return `${first} ${last}`.trim();
	}

	function getParticipantLastName() {
		const participant = getParticipant();
		const last = participant?.lastname?.trim();
		if (last) return last;
		const first = participant?.firstname?.trim();
		return first ?? '';
	}

	function getParticipantInitials() {
		const participant = getParticipant();
		if (participant?.firstname && participant?.lastname) {
			return `${participant.firstname[0]}${participant.lastname[0]}`;
		}
		return isTraineeParticipant() ? 'TR' : 'C';
	}

	function getParticipantDisplay() {
		const participant = getParticipant();
		if (!participant) {
			return isTraineeParticipant() ? 'Trainee saknas' : 'Klient saknas';
		}
		const first = participant.firstname?.trim() ?? '';
		const last = participant.lastname?.trim() ?? '';
		const full = `${first} ${last}`.trim();
		return full || (isTraineeParticipant() ? 'Trainee saknas' : 'Klient saknas');
	}

	// $: colWidth = 100 / columnCount;
	// $: colLeft = columnIndex * colWidth;

	const bookingIcon = $derived.by(() => {
		if (booking.booking.tryOut) return IconShiningStar;
		if (booking.booking.internalEducation) return IconWrench;
		if (booking.additionalInfo?.education) return IconGraduationCap;
		if (booking.additionalInfo?.internal) return IconPlane;
		return IconTraining;
	});

	function ensureMeasureContext() {
		if (!isBrowser) return null;
		if (!textMeasureCtx) {
			const canvas = document.createElement('canvas');
			textMeasureCtx = canvas.getContext('2d');
		}
		return textMeasureCtx;
	}

	function measureTextWidth(node: HTMLElement, text: string) {
		const ctx = ensureMeasureContext();
		if (!ctx) return text.length * 8;
		const style = getComputedStyle(node);
		const font =
			style.font && style.font !== ''
				? style.font
				: `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize}/${style.lineHeight} ${style.fontFamily}`;
		ctx.font = font;
		const letterSpacing = parseFloat(style.letterSpacing) || 0;
		return ctx.measureText(text).width + Math.max(0, text.length - 1) * letterSpacing;
	}

	function resolveTrainerDisplay(mode: NameDisplayMode) {
		const full = getTrainerDisplay() || trainerInitials;
		const last = getTrainerLastName() || full;
		if (mode === 'last') return last;
		if (mode === 'initials') return trainerInitials;
		return full;
	}

	function resolveParticipantDisplay(mode: NameDisplayMode) {
		const full = getParticipantDisplay();
		const last = getParticipantLastName() || full;
		if (mode === 'last') return last;
		if (mode === 'initials') return getParticipantInitials();
		return full;
	}

	function getNameStrings(): NameStrings {
		return {
			trainerFull: getTrainerDisplay(),
			trainerLast: getTrainerLastName(),
			participantFull: getParticipantDisplay(),
			participantLast: getParticipantLastName()
		};
	}

	function selectDisplayMode(
		fullWidth: number,
		lastWidth: number,
		initialsWidth: number,
		availableWidth: number
	): NameDisplayMode {
		if (fullWidth <= availableWidth) return 'full';
		if (lastWidth <= availableWidth) return 'last';
		return 'initials';
	}

	async function measureNameWidths(names: NameStrings = getNameStrings()) {
		if (!isBrowser || booking.isPersonalBooking) return;
		await tick();
		requestAnimationFrame(() => {
			if (!trainerNameElement || !clientNameElement) return;

			const trainerFullText = names.trainerFull?.trim() || trainerInitials;
			const trainerLastText = names.trainerLast?.trim() || trainerFullText;
			const participantInitials = getParticipantInitials();
			const participantFullText = names.participantFull?.trim() || participantInitials;
			const participantLastText = names.participantLast?.trim() || participantFullText;

			trainerFullWidth = measureTextWidth(trainerNameElement, trainerFullText);
			trainerLastWidth = measureTextWidth(trainerNameElement, trainerLastText);
			trainerInitialWidth = measureTextWidth(trainerNameElement, trainerInitials);

			participantFullWidth = measureTextWidth(clientNameElement, participantFullText);
			participantLastWidth = measureTextWidth(clientNameElement, participantLastText);
			participantInitialWidth = measureTextWidth(clientNameElement, participantInitials);

			checkNameWidths();
		});
	}

	function checkNameWidths() {
		if (!bookingSlot || booking.isPersonalBooking) return;

		const containerWidth = bookingSlot.offsetWidth;
		const availableWithIcon = Math.max(containerWidth - ICON_SPACE, 0);
		const availableWithoutIcon = containerWidth;

		const shouldShowIcon =
			trainerFullWidth <= availableWithIcon && participantFullWidth <= availableWithIcon;

		showIcon = shouldShowIcon;

		const effectiveWidth = shouldShowIcon ? availableWithIcon : availableWithoutIcon;

		trainerDisplayMode = selectDisplayMode(
			trainerFullWidth,
			trainerLastWidth,
			trainerInitialWidth,
			effectiveWidth
		);
		participantDisplayMode = selectDisplayMode(
			participantFullWidth,
			participantLastWidth,
			participantInitialWidth,
			effectiveWidth
		);
	}

	onMount(async () => {
		await tick(); // Ensure DOM elements are rendered

		isMounted = true;
		measureNameWidths(getNameStrings());

		const resizeObserver = new ResizeObserver(() => {
			if (debounceTimer) clearTimeout(debounceTimer);

			debounceTimer = setTimeout(() => {
				checkNameWidths();
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

	$effect(() => {
		const names = getNameStrings();

		if (isMounted && !booking.isPersonalBooking) {
			measureNameWidths(names);
		}
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
								{resolveTrainerDisplay(trainerDisplayMode)}
							</p>
							<p bind:this={clientNameElement}>
								{resolveParticipantDisplay(participantDisplayMode)}
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
