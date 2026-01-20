import { tick } from 'svelte';
import { clickOutside } from '$lib/actions/clickOutside';

export interface MultipleActionsParams {
	title?: string;
	description?: string;
	primaryAction?: () => void;
	primaryLabel?: string;
	secondaryAction?: () => void;
	secondaryLabel?: string;
	cancelLabel?: string;
}

export function multipleActions(node: HTMLElement, params: MultipleActionsParams) {
	let popover: HTMLDivElement | null = null;
	let visible = false;
	let cleanupOutside: (() => void) | null = null;

	const title = params.title ?? 'Choose action';
	const description = params.description ?? '';
	const primaryAction = params.primaryAction;
	const secondaryAction = params.secondaryAction;
	const primaryLabel = params.primaryLabel ?? 'Confirm';
	const secondaryLabel = params.secondaryLabel ?? 'Option';
	const cancelLabel = params.cancelLabel ?? 'Cancel';

	function onClick(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();

		if (!visible) show();
	}

	function show() {
		if (popover) return;

		popover = document.createElement('div');
		popover.className =
			'confirm-popover absolute z-2147483647 max-w-xs rounded-sm border border-gray-bright bg-white p-4 shadow-xl';

		const descriptionHtml = description
			? `<p class="mb-3 text-sm text-gray">${description}</p>`
			: '';
		const secondaryButtonHtml = secondaryAction
			? `<button data-secondary class="rounded-sm border border-gray bg-white px-3 py-1 text-sm text-gray hover:bg-gray-100 whitespace-nowrap">${secondaryLabel}</button>`
			: '';

		popover.innerHTML = `
			<div class="relative mb-2 pr-6">
				<p class="font-semibold text-gray">${title}</p>
				<button data-cancel aria-label="${cancelLabel}" class="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-sm text-gray hover:bg-gray-100 hover:text-gray-700">&times;</button>
			</div>
			${descriptionHtml}
			<div class="flex justify-end gap-2">
				${secondaryButtonHtml}
				<button data-primary class="rounded-sm bg-success hover:bg-success-hover px-3 py-1 text-sm text-white whitespace-nowrap">${primaryLabel}</button>
			</div>
		`;

		const closestDialog = node.closest('dialog') as HTMLElement | null;
		const openDialogs = Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];
		const host = closestDialog ?? openDialogs[openDialogs.length - 1] ?? document.body;
		if (getComputedStyle(host).position === 'static') {
			host.style.position = 'relative';
		}
		host.appendChild(popover);

		tick().then(() => {
			positionBox();

			cleanupOutside = clickOutside(popover!, hide).destroy;

			popover
				?.querySelector('[data-cancel]')
				?.addEventListener('click', hide);
			popover
				?.querySelector('[data-primary]')
				?.addEventListener('click', () => {
					primaryAction ? primaryAction() : node.click();
					hide();
				});
			popover
				?.querySelector('[data-secondary]')
				?.addEventListener('click', () => {
					secondaryAction?.();
					hide();
				});
		});

		visible = true;
	}

	function hide() {
		if (!popover) return;

		cleanupOutside?.();
		cleanupOutside = null;

		popover.remove();
		popover = null;
		visible = false;
	}

	function positionBox() {
		if (!popover) return;

		const trigger = node.getBoundingClientRect();
		const box = popover.getBoundingClientRect();
		const hostRect = ((node.closest('dialog') as HTMLElement) ?? document.body).getBoundingClientRect();
		const spacing = 8;

		let top: number;
		let left: number;

		const hasSpaceBelow = trigger.bottom + spacing + box.height < window.innerHeight;
		const hasSpaceAbove = trigger.top - spacing - box.height > 0;
		const hasSpaceRight = trigger.right + spacing + box.width < window.innerWidth;
		const hasSpaceLeft = trigger.left - spacing - box.width > 0;

		if (hasSpaceBelow) {
			top = trigger.bottom + spacing;
			left = trigger.left + trigger.width / 2 - box.width / 2;
		} else if (hasSpaceAbove) {
			top = trigger.top - box.height - spacing;
			left = trigger.left + trigger.width / 2 - box.width / 2;
		} else if (hasSpaceRight) {
			top = trigger.top + trigger.height / 2 - box.height / 2;
			left = trigger.right + spacing;
		} else if (hasSpaceLeft) {
			top = trigger.top + trigger.height / 2 - box.height / 2;
			left = trigger.left - box.width - spacing;
		} else {
			top = Math.max(spacing, window.innerHeight / 2 - box.height / 2);
			left = Math.max(spacing, window.innerWidth / 2 - box.width / 2);
		}

		top = Math.min(top, window.innerHeight - box.height - spacing);
		left = Math.min(left, window.innerWidth - box.width - spacing);
		top = Math.max(top, spacing);
		left = Math.max(left, spacing);

		popover.style.top = `${top - hostRect.top}px`;
		popover.style.left = `${left - hostRect.left}px`;
	}

	node.addEventListener('click', onClick);

	return {
		destroy() {
			node.removeEventListener('click', onClick);
			hide();
		}
	};
}
