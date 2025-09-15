import { tick } from 'svelte';

export interface ConfirmParams {
	title?: string;
	description?: string;
	action?: () => void;
	actionLabel?: string;
}

export function confirm(node: HTMLElement, params: ConfirmParams) {
	let dialogEl: HTMLDialogElement | null = null;
	let containerEl: HTMLDivElement | null = null;
	let visible = false;

	function ensureStyles() {
		if (typeof document === 'undefined') return;
		const id = 'confirm-dialog-inline-style';
		if (document.getElementById(id)) return;
		const style = document.createElement('style');
		style.id = id;
		style.textContent = 'dialog.confirm-dialog::backdrop { background: transparent; }';
		document.head.appendChild(style);
	}

	const title = params.title ?? 'Är du säker?';
	const description = params.description ?? 'Den här åtgärden kan inte ångras.';
	const action = params.action;
	const actionLabel = params.actionLabel ?? 'Ja';

	let onDialogCancel: ((event: Event) => void) | null = null;
	let onDialogClick: ((event: MouseEvent) => void) | null = null;

	function onClick(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();

		if (!visible) {
			show();
		}
	}

	async function show() {
		if (dialogEl) return;
		ensureStyles();

		dialogEl = document.createElement('dialog');
		dialogEl.className = 'confirm-dialog';
		dialogEl.style.padding = '0';
		dialogEl.style.border = 'none';
		dialogEl.style.background = 'transparent';
		dialogEl.style.position = 'fixed';
		dialogEl.style.margin = '0';
		dialogEl.style.inset = 'auto';
		dialogEl.style.overflow = 'visible';
		dialogEl.style.zIndex = '10000';

		containerEl = document.createElement('div');
		containerEl.className =
			'max-w-xs rounded-md border border-gray-bright bg-white p-4 shadow-xl';
		containerEl.innerHTML = `
			<p class="mb-1 font-semibold text-gray">${title}</p>
			<p class="mb-3 text-sm text-gray">${description}</p>
			<div class="flex justify-end gap-6">
				<button data-cancel class="text-base text-error hover:text-error-hover hover:underline">Avbryt</button>
				<button data-confirm class="rounded bg-success hover:bg-success-hover px-8 py-1 text-base text-white">${actionLabel}</button>
			</div>
		`;

		dialogEl.appendChild(containerEl);
		document.body.appendChild(dialogEl);

	onDialogCancel = () => hide();
	onDialogClick = (event: MouseEvent) => {
		if (!containerEl) return;
		const target = event.target as Node;
		if (target && !containerEl.contains(target)) hide();
	};

		dialogEl.addEventListener('cancel', onDialogCancel);
		dialogEl.addEventListener('click', onDialogClick);

		await tick();

		dialogEl.showModal();
		positionBox();

		containerEl
			?.querySelector('[data-cancel]')
			?.addEventListener('click', hide);
		containerEl
			?.querySelector('[data-confirm]')
			?.addEventListener('click', () => {
				action ? action() : node.click();
				hide();
			});

		visible = true;
	}

	function hide() {
		if (!dialogEl) return;

		const currentDialog = dialogEl;
		dialogEl = null;
		visible = false;

		if (onDialogCancel) currentDialog.removeEventListener('cancel', onDialogCancel);
		if (onDialogClick) currentDialog.removeEventListener('click', onDialogClick);

		onDialogCancel = null;
		onDialogClick = null;

		try {
			currentDialog.close();
		} catch {
			// dialog might already be closed
		}

		currentDialog.remove();
		containerEl = null;
	}

	function positionBox() {
		if (!dialogEl || !containerEl) return;

		const trigger = node.getBoundingClientRect();
		const box = containerEl.getBoundingClientRect();

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

		dialogEl.style.top = `${top}px`;
		dialogEl.style.left = `${left}px`;
	}

	node.addEventListener('click', onClick);

	return {
		destroy() {
			node.removeEventListener('click', onClick);
			hide();
		}
	};
}
