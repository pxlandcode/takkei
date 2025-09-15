import { tick } from 'svelte';
import { clickOutside } from '$lib/actions/clickOutside';

export interface ConfirmParams {
	title?: string;
	description?: string;
	action?: () => void;
	actionLabel?: string;
}

export function confirm(node: HTMLElement, params: ConfirmParams) {
	let popover: HTMLDivElement | null = null;
	let visible = false;
	let cleanupOutside: (() => void) | null = null;

	const title = params.title ?? 'Är du säker?';
	const description = params.description ?? 'Den här åtgärden kan inte ångras.';
	const action = params.action;
	const actionLabel = params.actionLabel ?? 'Ja';

	function onClick(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();

		if (!visible) show();
	}

	function show() {
		if (popover) return;

		popover = document.createElement('div');
		popover.className =
			'confirm-popover absolute z-[2147483647] max-w-xs rounded-md border border-gray-bright bg-white p-4 shadow-xl';

		popover.innerHTML = `
			<p class="mb-1 font-semibold text-gray">${title}</p>
			<p class="mb-3 text-sm text-gray">${description}</p>
			<div class="flex justify-end gap-6">
				<button data-cancel class="text-base text-error hover:text-error-hover hover:underline">Avbryt</button>
				<button data-confirm class="rounded bg-success hover:bg-success-hover px-8 py-1 text-base text-white">${actionLabel}</button>
			</div>
		`;

		const closestDialog = node.closest('dialog') as HTMLElement | null;
		const openDialogs = Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];
		const host = closestDialog ?? openDialogs[openDialogs.length - 1] ?? document.body;
		console.log('[confirm] attaching popover', {
			node,
			closestDialog,
			openDialogs,
			chosenHost: host,
			rootNode: node.getRootNode()
		});
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
				?.querySelector('[data-confirm]')
				?.addEventListener('click', () => {
					action ? action() : node.click();
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
