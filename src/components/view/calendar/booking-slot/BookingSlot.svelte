<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { getMeetingHeight, getTopOffset } from '$lib/helpers/calendarHelpers/calendar-utils';

	import { IconTraining, IconShiningStar, IconGraduationCap, IconPlane } from '$lib/icons';

	import type { FullBooking } from '$lib/types/calendarTypes';
	import { user } from '$lib/stores/userStore';
	import IconWrench from '$icons/IconWrench.svelte';

	type SlotVariant = 'default' | 'selected';

	type Props = {
		booking: FullBooking;
		startHour: number;
		hourHeight: number;
		toolTipText?: string;
		columnIndex?: number;
		columnCount?: number;
		onbookingselected: (event: MouseEvent) => void;
		variant?: SlotVariant;
		onclear?: (() => void) | null;
		clearLabel?: string;
	};

	let {
		booking,
		startHour,
		hourHeight,
		toolTipText,
		columnIndex = 0,
		columnCount = 1,
		onbookingselected,
		variant = 'default',
		onclear = null,
		clearLabel = 'Rensa vald tid'
	}: Props = $props();

	const SELECTED_BORDER_COLOR = '#fb923c';
	const SELECTED_BG_COLOR = '#fff7ed';
	const SELECTED_TEXT_COLOR = '#7c2d12';

	type NameDisplayMode = 'full' | 'last' | 'initials' | 'none';
	type NameStrings = {
		trainerFull: string;
		trainerLast: string;
		participantFull: string;
		participantLast: string;
	};

	let bookingSlot: HTMLButtonElement | undefined = $state();
	let trainerNameElement: HTMLParagraphElement | undefined = $state();
	let clientNameElement: HTMLParagraphElement | undefined = $state();
	let personalTextElement: HTMLParagraphElement | undefined = $state();
	let trainerDisplayMode = $state<NameDisplayMode>('full');
	let participantDisplayMode = $state<NameDisplayMode>('full');
	let personalLineClamp = $state(1);
	let debounceTimer: NodeJS.Timeout;
	let showIcon = $state(true);
	let showTrainerLine = $state(true);
	let showParticipantLine = $state(true);
	const ICON_SPACE = 32;
	const PERSONAL_VERTICAL_PADDING = 8;
	const DEFAULT_LINE_HEIGHT = 14;
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
	const isSelectedVariant = $derived(variant === 'selected');

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
		return isTraineeParticipant() ? (booking.trainee ?? null) : (booking.client ?? null);
	}

	function normalizeKind(kind?: string | null) {
		if (!kind) return '';
		return kind
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	const isMeetingSlot = $derived(() => {
		if (!booking.isPersonalBooking) return false;
		const personalKind = normalizeKind(booking.personalBooking?.kind ?? null);
		const contentKind = normalizeKind(booking.additionalInfo?.bookingContent?.kind ?? null);
		return (
			personalKind.includes('meeting') ||
			personalKind.includes('mote') ||
			contentKind.includes('meeting') ||
			contentKind.includes('mote')
		);
	});

	function getPersonalDisplayText() {
		const name = booking.personalBooking?.name?.trim() ?? '';
		const text = booking.personalBooking?.text?.trim() ?? '';
		if (name && text) return `${name} - ${text}`;
		if (name) return name;
		if (text) return text;
		return isMeetingSlot() ? 'Möte' : 'Personlig bokning';
	}

	const personalDisplayText = $derived(getPersonalDisplayText());

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
		if (mode === 'none') return '';
		const full = getTrainerDisplay() || trainerInitials;
		const last = getTrainerLastName() || full;
		if (mode === 'last') return last;
		if (mode === 'initials') return trainerInitials;
		return full;
	}

	function resolveParticipantDisplay(mode: NameDisplayMode) {
		if (mode === 'none') return '';
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

	const nameStrings = $derived(getNameStrings());

	function selectDisplayMode(
		fullWidth: number,
		lastWidth: number,
		initialsWidth: number,
		availableWidth: number
	): NameDisplayMode {
		if (availableWidth <= 0) return 'none';
		if (fullWidth > 0 && fullWidth <= availableWidth) return 'full';
		if (lastWidth > 0 && lastWidth <= availableWidth) return 'last';
		if (initialsWidth > 0 && initialsWidth <= availableWidth) return 'initials';
		return 'none';
	}

	async function measurePersonalText(_displayText?: string) {
		if (!isBrowser || !booking.isPersonalBooking) return;
		void _displayText;
		await tick();
		requestAnimationFrame(() => {
			if (!bookingSlot || !personalTextElement) return;

			const slotHeight = bookingSlot.offsetHeight || Math.max(meetingHeight - 4, 0);
			const availableHeight = Math.max(slotHeight - PERSONAL_VERTICAL_PADDING, DEFAULT_LINE_HEIGHT);
			const style = getComputedStyle(personalTextElement);
			const lineHeightValue = parseFloat(style.lineHeight);
			const fontSizeValue = parseFloat(style.fontSize);
			const fallbackLineHeight = Number.isFinite(lineHeightValue)
				? lineHeightValue
				: Number.isFinite(fontSizeValue)
					? fontSizeValue * 1.2
					: DEFAULT_LINE_HEIGHT;
			const safeLineHeight = Math.max(fallbackLineHeight, 1);
			const maxLines = isMeetingSlot()
				? 1
				: Math.max(Math.floor(availableHeight / safeLineHeight), 1);
			personalLineClamp = Math.max(isMeetingSlot() ? 1 : maxLines, 1);
		});
	}

	async function measureNameWidths(names: NameStrings = nameStrings) {
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

		const resolvedTrainerMode = selectDisplayMode(
			trainerFullWidth,
			trainerLastWidth,
			trainerInitialWidth,
			effectiveWidth
		);
		const resolvedParticipantMode = selectDisplayMode(
			participantFullWidth,
			participantLastWidth,
			participantInitialWidth,
			effectiveWidth
		);

		const initialsWidthCombined = trainerInitialWidth + participantInitialWidth;

		if (
			resolvedTrainerMode === 'none' &&
			resolvedParticipantMode === 'none' &&
			initialsWidthCombined <= effectiveWidth
		) {
			trainerDisplayMode = 'initials';
			participantDisplayMode = 'initials';
			showTrainerLine = true;
			showParticipantLine = true;
		} else {
			trainerDisplayMode = resolvedTrainerMode;
			participantDisplayMode = resolvedParticipantMode;
			showTrainerLine = resolvedTrainerMode !== 'none';
			showParticipantLine = resolvedParticipantMode !== 'none';
		}
	}

	onMount(async () => {
		await tick(); // Ensure DOM elements are rendered

		isMounted = true;
		if (booking.isPersonalBooking) {
			void measurePersonalText(personalDisplayText);
		} else {
			measureNameWidths(nameStrings);
		}

		const resizeObserver = new ResizeObserver(() => {
			if (debounceTimer) clearTimeout(debounceTimer);

			debounceTimer = setTimeout(() => {
				if (!booking) return;
				if (booking.isPersonalBooking) {
					void measurePersonalText(personalDisplayText);
				} else {
					checkNameWidths();
				}
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
		if (!isMounted || !booking) return;
		if (booking.isPersonalBooking) {
			void measurePersonalText(personalDisplayText);
			return;
		}
		const names = nameStrings;
		measureNameWidths(names);
	});
</script>

<button
	type="button"
	bind:this={bookingSlot}
	on:click={onbookingselected}
	class="absolute z-20 flex cursor-pointer flex-col gap-[2px] p-1 text-xs shadow-xs {showIcon
		? 'items-start'
		: 'items-center'} {booking.trainer?.id === $user?.id
		? 'border-2'
		: ''} {booking.isPersonalBooking
		? isMeetingSlot()
			? 'bg-gray-400/80 text-black'
			: 'bg-black/60 text-white'
		: ''}"
	class:text-gray={!booking.isPersonalBooking}
	class:selected-slot={isSelectedVariant}
	style:top={`${topOffset + 1}px`}
	style:height={`${meetingHeight - 2}px`}
	style:left={`calc(${colLeft}% + 1px)`}
	style:width={`calc(${colWidth}% - 2px)`}
	style:background-color={!booking.isPersonalBooking
		? isSelectedVariant
			? SELECTED_BG_COLOR
			: `${bookingColor}20`
		: null}
	style:border-color={!booking.isPersonalBooking
		? isSelectedVariant
			? SELECTED_BORDER_COLOR
			: bookingColor
		: null}
	style:color={isSelectedVariant ? SELECTED_TEXT_COLOR : null}
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
						<p class="" bind:this={trainerNameElement} class:hidden={trainerDisplayMode === 'none'}>
							{resolveTrainerDisplay(trainerDisplayMode)}
						</p>
						<p bind:this={clientNameElement} class:hidden={participantDisplayMode === 'none'}>
							{resolveParticipantDisplay(participantDisplayMode)}
						</p>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="flex w-full flex-col text-xs">
			<p
				class={`personal-text ${isMeetingSlot() ? 'personal-text--single' : ''}`}
				bind:this={personalTextElement}
				style={`-webkit-line-clamp: ${personalLineClamp}; line-clamp: ${personalLineClamp};`}
			>
				{personalDisplayText}
			</p>
		</div>
	{/if}
</button>

<style>
	.personal-text {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: break-word;
		text-overflow: ellipsis;
	}

	.personal-text--single {
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	button.selected-slot {
		border-width: 2px;
		border-style: dashed;
		box-shadow: 0 4px 12px rgba(249, 115, 22, 0.2);
	}
</style>
