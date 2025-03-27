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
		console.log('onClick', 'confirm');
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

		let top = trigger.bottom + 8;
		let left = trigger.left + trigger.width / 2 - box.width / 2;

		// Clamp
		if (left + box.width > window.innerWidth - 10) {
			left = window.innerWidth - box.width - 10;
		}
		if (left < 10) left = 10;

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
