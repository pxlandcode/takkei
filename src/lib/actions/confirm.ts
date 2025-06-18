import { tick } from 'svelte';
import { clickOutside } from '$lib/actions/clickOutside';

export interface ConfirmParams {
	title?: string;
	description?: string;
	action?: () => void;
	actionLabel?: string;
}

export function confirm(node: HTMLElement, params: ConfirmParams) {
	let confirmBox: HTMLDivElement | null = null;
	let visible = false;

	const title = params.title ?? 'Är du säker?';
	const description = params.description ?? 'Den här åtgärden kan inte ångras.';
	const action = params.action;
	const actionLabel = params.actionLabel ?? 'Ja';

	function onClick(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();

		if (!visible) {
			show();
		}
	}

	function show() {
		if (confirmBox) return;

		confirmBox = document.createElement('div');
		confirmBox.className =
			'fixed z-50 max-w-xs rounded-md border border-gray-bright bg-white p-4 shadow-xl';
		confirmBox.innerHTML = `
			<p class="mb-1 font-semibold text-gray">${title}</p>
			<p class="mb-3 text-sm text-gray">${description}</p>
			<div class="flex justify-end gap-6">
				<button data-cancel class="text-base text-error hover:text-error-hover hover:underline">Avbryt</button>
				<button data-confirm class="rounded bg-success hover:bg-success-hover px-8 py-1 text-base text-white">${actionLabel}</button>
			</div>
		`;

		document.body.appendChild(confirmBox);

		tick().then(() => {
			positionBox();

			// Use your custom action for clickOutside detection
			clickOutside(confirmBox!, () => hide());
		});

		// Action buttons
		confirmBox.querySelector('[data-cancel]')?.addEventListener('click', hide);
		confirmBox.querySelector('[data-confirm]')?.addEventListener('click', () => {
			action ? action() : node.click(); // fallback to default click
			hide();
		});

		visible = true;
	}

	function hide() {
		confirmBox?.remove();
		confirmBox = null;
		visible = false;
	}

	function positionBox() {
		if (!confirmBox) return;

		const trigger = node.getBoundingClientRect();
		const box = confirmBox.getBoundingClientRect();

		const spacing = 8;
		let top: number;
		let left: number;

		const hasSpaceBelow = trigger.bottom + spacing + box.height < window.innerHeight;
		const hasSpaceAbove = trigger.top - spacing - box.height > 0;
		const hasSpaceRight = trigger.right + spacing + box.width < window.innerWidth;
		const hasSpaceLeft = trigger.left - spacing - box.width > 0;

		if (hasSpaceBelow) {
			// Place below
			top = trigger.bottom + spacing;
			left = trigger.left + trigger.width / 2 - box.width / 2;
		} else if (hasSpaceAbove) {
			// Place above
			top = trigger.top - box.height - spacing;
			left = trigger.left + trigger.width / 2 - box.width / 2;
		} else if (hasSpaceRight) {
			// Place to the right
			top = trigger.top + trigger.height / 2 - box.height / 2;
			left = trigger.right + spacing;
		} else if (hasSpaceLeft) {
			// Place to the left
			top = trigger.top + trigger.height / 2 - box.height / 2;
			left = trigger.left - box.width - spacing;
		} else {
			// Center in viewport as last resort
			top = Math.max(spacing, window.innerHeight / 2 - box.height / 2);
			left = Math.max(spacing, window.innerWidth / 2 - box.width / 2);
		}

		// Clamp to viewport edges
		top = Math.min(top, window.innerHeight - box.height - spacing);
		left = Math.min(left, window.innerWidth - box.width - spacing);
		top = Math.max(top, spacing);
		left = Math.max(left, spacing);

		confirmBox.style.top = `${top}px`;
		confirmBox.style.left = `${left}px`;
		confirmBox.style.position = 'absolute';
	}

	node.addEventListener('click', onClick);

	return {
		destroy() {
			node.removeEventListener('click', onClick);
			hide();
		}
	};
}
