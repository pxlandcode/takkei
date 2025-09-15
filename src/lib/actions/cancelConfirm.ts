import { tick } from 'svelte';
import { clickOutside } from '$lib/actions/clickOutside';

interface CancelParams {
	onConfirm: (reason: string, time: string) => void;
	startTimeISO: string;
}

export function cancelConfirm(node: HTMLElement, { onConfirm, startTimeISO }: CancelParams) {
	let popover: HTMLDivElement | null = null;
	let visible = false;
	let cleanupOutside: (() => void) | null = null;
	const time = new Date().toISOString().slice(0, 16);

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

	function onClick(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (!visible) show();
	}

	function show() {
		if (popover) return;

		popover = document.createElement('div');
		popover.className =
			'cancel-popover absolute z-[2147483647] max-w-xs rounded-md border border-gray-bright bg-white p-4 shadow-xl';

		popover.innerHTML = `
      <p class="mb-2 font-semibold text-gray">Avbryt bokning</p>
      <input data-reason type="text" placeholder="Orsak krävs" class="w-full border px-2 py-1 mb-2 text-sm" />
      <input data-time type="datetime-local" class="w-full border px-2 py-1 text-sm" value="${time}" />
      <p data-late-note class="mt-2 text-xs text-error hidden">Sen avbokning – debiteringsregler kan gälla.</p>
      <div class="mt-3 flex justify-end gap-4">
        <button data-cancel class="text-base text-error hover:text-error-hover hover:underline">Avbryt</button>
        <button data-confirm disabled class="rounded bg-gray px-6 py-1 text-base text-white cursor-not-allowed">Bekräfta</button>
      </div>
    `;

		const closestDialog = node.closest('dialog') as HTMLElement | null;
		const openDialogs = Array.from(document.querySelectorAll('dialog[open]')) as HTMLElement[];
		const host = closestDialog ?? openDialogs[openDialogs.length - 1] ?? document.body;
		console.log('[cancelConfirm] attaching popover', {
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

			const reasonInput = popover!.querySelector<HTMLInputElement>('[data-reason]')!;
			const timeInput = popover!.querySelector<HTMLInputElement>('[data-time]')!;
			const confirmBtn = popover!.querySelector<HTMLButtonElement>('[data-confirm]')!;
			const lateNote = popover!.querySelector<HTMLParagraphElement>('[data-late-note]')!;

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

			popover
				?.querySelector('[data-cancel]')
				?.addEventListener('click', hide);
			popover
				?.querySelector('[data-confirm]')
				?.addEventListener('click', () => {
					const reasonVal = reasonInput.value;
					const timeVal = timeInput.value;
					onConfirm(reasonVal, timeVal);
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
		const boxRect = popover.getBoundingClientRect();
		const hostRect = ((node.closest('dialog') as HTMLElement) ?? document.body).getBoundingClientRect();
		const spacing = 8;

		let top = trigger.bottom + spacing;
		let left = trigger.left + trigger.width / 2 - boxRect.width / 2;

		top = Math.min(top, window.innerHeight - boxRect.height - spacing);
		left = Math.min(left, window.innerWidth - boxRect.width - spacing);
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
