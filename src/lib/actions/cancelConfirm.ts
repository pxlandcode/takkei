import { tick } from 'svelte';

interface CancelParams {
	onConfirm: (reason: string, time: string) => void;
	startTimeISO: string;
}

export function cancelConfirm(node: HTMLElement, { onConfirm, startTimeISO }: CancelParams) {
	let dialogEl: HTMLDialogElement | null = null;
	let containerEl: HTMLDivElement | null = null;
	let visible = false;
	const time = new Date().toISOString().slice(0, 16);

	function ensureStyles() {
		if (typeof document === 'undefined') return;
		const id = 'cancel-dialog-inline-style';
		if (document.getElementById(id)) return;
		const style = document.createElement('style');
		style.id = id;
		style.textContent = 'dialog.cancel-dialog::backdrop { background: transparent; }';
		document.head.appendChild(style);
	}

	let onDialogCancel: ((event: Event) => void) | null = null;
	let onDialogClick: ((event: MouseEvent) => void) | null = null;

	function sameYMD(a: Date, b: Date) {
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}
	function withinCancellationWindow(start: Date, cancelAt: Date) {
		const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate());
		const cancelPlus24 = new Date(cancelAt.getTime() + 24 * 60 * 60 * 1000);

		const dayAfterCancel = new Date(
			cancelAt.getFullYear(),
			cancelAt.getMonth(),
			cancelAt.getDate() + 1
		);
		const okTomorrowBeforeNoon = sameYMD(start, dayAfterCancel) && cancelAt.getHours() < 12;

		return startMidnight > cancelPlus24 || okTomorrowBeforeNoon;
	}
	function isLate(startISO: string, cancelLocalValue: string) {
		const start = new Date(startISO);
		const cancel = new Date(cancelLocalValue.replace(' ', 'T'));
		return !withinCancellationWindow(start, cancel);
	}

	function onClick(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (!visible) show();
	}

	async function show() {
		if (dialogEl) return;
		ensureStyles();

		dialogEl = document.createElement('dialog');
		dialogEl.className = 'cancel-dialog';
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
      <p class="mb-2 font-semibold text-gray">Avbryt bokning</p>
      <input data-reason type="text" placeholder="Orsak krävs" class="w-full border px-2 py-1 mb-2 text-sm" />
      <input data-time type="datetime-local" class="w-full border px-2 py-1 text-sm" value="${time}" />
      <p data-late-note class="mt-2 text-xs text-error hidden">Sen avbokning – debiteringsregler kan gälla.</p>
      <div class="mt-3 flex justify-end gap-4">
        <button data-cancel class="text-base text-error hover:text-error-hover hover:underline">Avbryt</button>
        <button data-confirm disabled class="rounded bg-gray px-6 py-1 text-base text-white cursor-not-allowed">Bekräfta</button>
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

		const reasonInput = containerEl.querySelector<HTMLInputElement>('[data-reason]')!;
		const timeInput = containerEl.querySelector<HTMLInputElement>('[data-time]')!;
		const confirmBtn = containerEl.querySelector<HTMLButtonElement>('[data-confirm]')!;
		const lateNote = containerEl.querySelector<HTMLParagraphElement>('[data-late-note]')!;

		const toggleLateNote = () => {
			const late = isLate(startTimeISO, timeInput.value);
			lateNote.classList.toggle('hidden', !late);
		};

		reasonInput.addEventListener('input', () => {
			const val = reasonInput.value.trim();
			confirmBtn.disabled = val === '';
			confirmBtn.className = val
				? 'rounded bg-success hover:bg-success-hover px-6 py-1 text-base text-white'
				: 'rounded bg-gray px-6 py-1 text-base text-white cursor-not-allowed';
		});

		timeInput.addEventListener('input', toggleLateNote);
		toggleLateNote();

		containerEl
			?.querySelector('[data-cancel]')
			?.addEventListener('click', hide);
		containerEl
			?.querySelector('[data-confirm]')
			?.addEventListener('click', () => {
				const reasonVal = reasonInput.value;
				const timeVal = timeInput.value;
				onConfirm(reasonVal, timeVal);
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
		} catch {}

		currentDialog.remove();
		containerEl = null;
	}

	function positionBox() {
		if (!dialogEl || !containerEl) return;
		const trigger = node.getBoundingClientRect();
		const boxRect = containerEl.getBoundingClientRect();
		const spacing = 8;

		let top = trigger.bottom + spacing;
		let left = trigger.left + trigger.width / 2 - boxRect.width / 2;

		top = Math.min(top, window.innerHeight - boxRect.height - spacing);
		left = Math.min(left, window.innerWidth - boxRect.width - spacing);
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
