<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { slide } from 'svelte/transition';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import { ripple } from '$lib/actions/ripple';
	import { relativeTime } from './homeModernUtils';
	import type { HomeModernNotificationEvent } from './homeModernTypes';
	import { getNotificationDisplayStart } from '$lib/utils/notifications';

	type NotificationOverflowField = 'title' | 'description';

	export let event: HomeModernNotificationEvent;
	export let isMarking = false;

	const dispatch = createEventDispatcher<{
		done: { id: number };
	}>();

	let titleTruncated = false;
	let descriptionTruncated = false;
	let isExpanded = false;

	$: isExpandable = titleTruncated || descriptionTruncated || !!event.link;
	$: if (!isExpandable && isExpanded) {
		isExpanded = false;
	}

	$: typeColor =
		event.event_type === 'client'
			? 'bg-orange'
			: event.event_type === 'alert'
				? 'bg-red'
				: event.event_type === 'info'
					? 'bg-green'
					: event.event_type === 'article'
						? 'bg-primary'
						: 'bg-gray-400';

	function updateOverflow(field: NotificationOverflowField, isTruncated: boolean) {
		if (field === 'title') {
			titleTruncated = isTruncated;
			return;
		}

		descriptionTruncated = isTruncated;
	}

	function observeTruncation(
		node: HTMLElement,
		params: { field: NotificationOverflowField; active?: boolean }
	) {
		let { field } = params;
		let active = params.active ?? true;
		let frameId = 0;

		const measure = () => {
			if (!active) return;

			cancelAnimationFrame(frameId);
			frameId = requestAnimationFrame(() => {
				if (!active) return;
				const isTruncated =
					node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
				updateOverflow(field, isTruncated);
			});
		};

		const observer =
			typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
		observer?.observe(node);
		measure();

		return {
			update(nextParams: { field: NotificationOverflowField; active?: boolean }) {
				const nextActive = nextParams.active ?? true;
				if (nextParams.field === field && nextActive === active) return;

				if (nextParams.field !== field) {
					updateOverflow(field, false);
				}

				field = nextParams.field;
				active = nextActive;

				if (active) {
					measure();
				}
			},
			destroy() {
				cancelAnimationFrame(frameId);
				observer?.disconnect();
			}
		};
	}

	function requestDone(mouseEvent?: MouseEvent) {
		if (mouseEvent) {
			const target = mouseEvent.currentTarget;
			if (target instanceof HTMLElement) {
				const row = target.closest('.notification-row');
				const rippleLayer = row?.querySelector<HTMLElement>('[data-notification-ripple]');

				if (rippleLayer) {
					const targetRect = target.getBoundingClientRect();
					const clientX = mouseEvent.clientX || targetRect.left + targetRect.width / 2;
					const clientY = mouseEvent.clientY || targetRect.top + targetRect.height / 2;

					rippleLayer.dispatchEvent(
						new PointerEvent('pointerdown', {
							button: 0,
							clientX,
							clientY
						})
					);
				}
			}
		}

		dispatch('done', { id: event.id });
	}

	function handleRowClick() {
		if (isMarking) {
			requestDone();
			return;
		}

		if (isExpandable) {
			isExpanded = !isExpanded;
		}
	}

	function handleRowKeydown(keyboardEvent: KeyboardEvent) {
		if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return;
		keyboardEvent.preventDefault();
		handleRowClick();
	}
</script>

<div
	class="notification-row group relative flex items-start gap-2 overflow-hidden py-2"
	class:cursor-pointer={isExpandable || isMarking}
	role="button"
	tabindex="0"
	aria-disabled={!isExpandable && !isMarking}
	aria-expanded={isExpandable ? isExpanded : undefined}
	transition:slide={{ duration: 300 }}
	on:click={handleRowClick}
	on:keydown={handleRowKeydown}
>
	<div
		data-notification-ripple
		class="pointer-events-none absolute inset-0 z-0"
		use:ripple={{ color: '#22c55e', opacity: 0.25, duration: 800 }}
	></div>
	<div class="relative z-10 h-2 w-2 flex-shrink-0 {typeColor}"></div>
	<div class="relative z-10 min-w-0 flex-1">
		<div class="flex items-start gap-2">
			<span
				use:observeTruncation={{ field: 'title', active: !isExpanded }}
				class="min-w-0 flex-1 text-xs font-medium text-gray-900"
				class:truncate={!isExpanded}
				class:break-words={isExpanded}
				class:whitespace-normal={isExpanded}
			>
				{event.name}
			</span>
			<div class="grid flex-shrink-0 grid-cols-[auto_12px] items-center gap-1">
				<span class="text-[10px] text-gray-400">
					{relativeTime(getNotificationDisplayStart(event))}
				</span>
				<span
					class="group-hover:text-primary inline-flex w-3 justify-center text-gray-300 transition-[transform,color] duration-200"
					class:rotate-180={isExpanded}
					class:invisible={!isExpandable}
				>
					{#if isExpandable}
						<Icon icon="ChevronDown" size="12px" />
					{/if}
				</span>
			</div>
		</div>
		{#if event.description}
			<p
				use:observeTruncation={{ field: 'description', active: !isExpanded }}
				class="text-[11px] leading-4 text-gray-500"
				class:mt-1={isExpanded}
				class:truncate={!isExpanded}
				class:break-words={isExpanded}
				class:whitespace-normal={isExpanded}
			>
				{event.description}
			</p>
		{/if}
		{#if isExpanded && event.link}
			<a
				href={event.link}
				class="text-primary hover:text-primary-hover mt-1 inline-block text-[11px] font-semibold underline"
				on:click|stopPropagation
			>
				{event.link.startsWith('/news') ? 'Läs hela artikeln' : 'Öppna'}
			</a>
		{/if}
	</div>
	<button
		class="hover:text-green relative z-10 -my-2 -mr-1 flex w-11 flex-shrink-0 items-center justify-center self-stretch text-gray-400"
		aria-label="Markera som klar"
		on:click|stopPropagation={(mouseEvent) => requestDone(mouseEvent)}
	>
		<span
			class="inline-flex h-6 w-6 items-center justify-center text-base text-current opacity-0 transition-[opacity,color] duration-200 group-hover:opacity-100"
			class:opacity-100={isExpanded || isMarking}
		>
			✓
		</span>
	</button>
</div>
