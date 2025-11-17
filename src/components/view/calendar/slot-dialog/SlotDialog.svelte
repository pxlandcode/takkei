<script lang="ts">
	import { onDestroy } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import { clickOutside } from '$lib/actions/clickOutside';
	import Button from '../../../bits/button/Button.svelte';
	import type { FullBooking } from '$lib/types/calendarTypes';
	import type { SelectedSlot } from '$lib/stores/selectedSlotStore';

	type ActionsConfig = {
		mode: 'actions';
		booking: FullBooking;
		startTime: Date;
		locationId: number;
	};

	type SelectConfig = {
		mode: 'select';
		bookings: FullBooking[];
		startTime: Date;
		locationId: number;
	};

	type SelectedSlotConfig = {
		mode: 'selected-slot';
		slot: SelectedSlot;
	};

	type SlotDialogConfig = ActionsConfig | SelectConfig | SelectedSlotConfig;

	let {
		anchor = null,
		config = null
	}: {
		anchor?: HTMLElement | null;
		config?: SlotDialogConfig | null;
	} = $props();

	const dispatch = createEventDispatcher<{
		close: void;
		openBooking: { booking: FullBooking };
		createBooking: { startTime: Date };
		pinnedSlotBook: { slot: SelectedSlot };
		pinnedSlotClear: void;
	}>();

	let dialogEl: HTMLDialogElement | null = null;
	let host: HTMLElement | null = null;
	let destroyOutside: (() => void) | null = null;

	function formatBookingTimeRange(booking: FullBooking): string {
		if (!booking?.booking?.startTime) return '';

		const start = new Date(booking.booking.startTime);
		const end = booking.booking.endTime
			? new Date(booking.booking.endTime)
			: new Date(start.getTime() + 60 * 60 * 1000);

		return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
	}

	function getParticipantName(booking: FullBooking): string {
		if (booking.isPersonalBooking) {
			return booking.personalBooking?.name ?? 'Bokning';
		}

		const useTrainee = booking.booking.internalEducation || booking.additionalInfo?.education;
		if (useTrainee) {
			const trainee = booking.trainee;
			const traineeName = `${trainee?.firstname ?? ''} ${trainee?.lastname ?? ''}`.trim();
			return traineeName || 'Trainee saknas';
		}

		if (booking.client) {
			return `${booking.client.firstname} ${booking.client.lastname}`.trim() || 'Kund saknas';
		}

		return 'Bokning';
	}

	function teardown() {
		destroyOutside?.();
		destroyOutside = null;

		window.removeEventListener('resize', positionDialog, true);
		window.removeEventListener('scroll', positionDialog, true);

		if (dialogEl) {
			dialogEl.removeEventListener('cancel', handleCancel);
			if (dialogEl.open) {
				try {
					dialogEl.close();
				} catch {
					// ignore close failures
				}
			}
			if (dialogEl.isConnected) {
				dialogEl.remove();
			}
		}
	}

	function handleCancel(event: Event) {
		event.preventDefault();
		dispatch('close');
	}

	function positionDialog() {
		if (!dialogEl || !anchor || !host) return;
		if (!anchor.isConnected) {
			dispatch('close');
			return;
		}

		const spacing = 8;
		const anchorRect = anchor.getBoundingClientRect();
		const hostRect = host.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		// Clamp width to viewport to prevent overflow
		const currentRect = dialogEl.getBoundingClientRect();
		const maxWidth = Math.min(currentRect.width, viewportWidth - spacing * 2);
		if (currentRect.width !== maxWidth) {
			dialogEl.style.width = `${maxWidth}px`;
		}

		const rect = dialogEl.getBoundingClientRect();
		const width = rect.width;
		const height = rect.height;

		const hasSpaceAbove = anchorRect.top >= height + spacing;
		const hasSpaceBelow = anchorRect.bottom + height + spacing <= viewportHeight;

		let top: number;
		if (hasSpaceAbove || (!hasSpaceBelow && anchorRect.top > viewportHeight / 2)) {
			top = anchorRect.top - height - spacing;
		} else {
			top = anchorRect.bottom + spacing;
		}

		top = Math.max(spacing, Math.min(top, viewportHeight - height - spacing));

		let left = anchorRect.left + anchorRect.width / 2 - width / 2;
		left = Math.max(spacing, Math.min(left, viewportWidth - width - spacing));

		dialogEl.style.top = `${top - hostRect.top}px`;
		dialogEl.style.left = `${left - hostRect.left}px`;
	}

	function ensureDialog() {
		if (!dialogEl || !config || !anchor) return;
		if (!anchor.isConnected) {
			dispatch('close');
			return;
		}

		const anchorRoot = anchor.closest('dialog') as HTMLElement | null;
		const openDialogs = Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];
		host = anchorRoot ?? openDialogs[openDialogs.length - 1] ?? document.body;

		if (!dialogEl.isConnected) {
			host.appendChild(dialogEl);
		}

		if (getComputedStyle(host).position === 'static') {
			host.style.position = 'relative';
		}

		dialogEl.addEventListener('cancel', handleCancel);

		if (!dialogEl.open) {
			dialogEl.show();
		}

		positionDialog();

		window.addEventListener('resize', positionDialog, true);
		window.addEventListener('scroll', positionDialog, true);

		const outside = clickOutside(dialogEl, () => dispatch('close'));
		destroyOutside = () => outside.destroy();
	}

	$effect(() => {
		teardown();

		if (!config || !anchor || !dialogEl) {
			return;
		}

		queueMicrotask(() => {
			if (!anchor || !anchor.isConnected) {
				dispatch('close');
				return;
			}
			ensureDialog();
		});
	});

	onDestroy(() => {
		teardown();
	});
</script>

<dialog
	bind:this={dialogEl}
	class="pointer-events-auto z-[2147483646] max-w-sm rounded-sm bg-transparent p-0"
>
	{#if config?.mode === 'actions'}
		<div class="flex max-w-sm min-w-[240px] flex-row gap-3">
			<button
				type="button"
				class="rounded-sm border border-gray-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange-500"
				on:click={() => dispatch('openBooking', { booking: config.booking })}
			>
				<div class="flex flex-col gap-0.5">
					<span class="font-medium text-gray-800">{getParticipantName(config.booking)}</span>
					<span class="text-xs text-gray-500">
						{formatBookingTimeRange(config.booking)}
					</span>
					{#if config.booking.trainer}
						<span class="text-xs text-gray-500">
							{config.booking.trainer.firstname}
							{config.booking.trainer.lastname}
						</span>
					{/if}
				</div>
			</button>

			<div class="flex items-center justify-center">
				<Button
					iconLeft="Plus"
					variant="primary"
					text="Boka"
					iconLeftSize="13px"
					on:click={() => dispatch('createBooking', { startTime: config.startTime })}
				/>
			</div>
		</div>
	{:else if config?.mode === 'select'}
		<div class="flex max-w-sm min-w-[240px] flex-row gap-3">
			<div class="flex flex-row gap-2">
				{#each config.bookings as option (option.booking.id)}
					<button
						type="button"
						class="rounded-sm border border-gray-200 bg-white px-3 py-2 text-left text-sm transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-orange-500"
						on:click={() => dispatch('openBooking', { booking: option })}
					>
						<div class="flex flex-col gap-0.5">
							<span class="font-medium text-gray-800">{getParticipantName(option)}</span>
							<span class="text-xs text-gray-500">
								{formatBookingTimeRange(option)}
							</span>
							{#if option.trainer}
								<span class="text-xs text-gray-500">
									{option.trainer.firstname}
									{option.trainer.lastname}
								</span>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</div>
	{:else if config?.mode === 'selected-slot'}
		<div class="flex gap-2 rounded-sm bg-transparent p-0">
			<Button
				text="Rensa"
				variant="cancel"
				small
				iconLeft="Trash"
				on:click={() => dispatch('pinnedSlotClear')}
			/>
			<Button
				text="Boka"
				variant="primary"
				small
				iconLeftSize="12px"
				iconLeft="Plus"
				on:click={() => dispatch('pinnedSlotBook', { slot: config.slot })}
			/>
		</div>
	{/if}
</dialog>
