import { tick } from 'svelte';
import { clickOutside } from '$lib/actions/clickOutside';

interface CancelParams {
	onConfirm: (reason: string, time: string) => void;
}

export function cancelConfirm(node: HTMLElement, { onConfirm }: CancelParams) {
	let box: HTMLDivElement | null = null;
	let visible = false;
	let reason = '';
	let time = new Date().toISOString().slice(0, 16);

	function show() {
		if (box) return;

		box = document.createElement('div');
		box.className =
			'fixed z-50 max-w-xs rounded-md border border-gray-bright bg-white p-4 shadow-xl';
		box.innerHTML = `
			<p class="mb-2 font-semibold text-gray">Avbryt bokning</p>
			<input data-reason type="text" placeholder="Orsak krävs" class="w-full border px-2 py-1 mb-2 text-sm" />
			<input data-time type="datetime-local" class="w-full border px-2 py-1 mb-3 text-sm" value="${time}" />
			<div class="flex justify-end gap-4">
				<button data-cancel class="text-base text-error hover:text-error-hover hover:underline">Avbryt</button>
				<button data-confirm disabled class="rounded bg-gray px-6 py-1 text-base text-white cursor-not-allowed">Bekräfta</button>
			</div>
		`;

		document.body.appendChild(box);

		tick().then(() => {
			positionBox();
			clickOutside(box!, hide);

			const reasonInput = box!.querySelector<HTMLInputElement>('[data-reason]')!;
			const confirmBtn = box!.querySelector<HTMLButtonElement>('[data-confirm]')!;

			reasonInput.addEventListener('input', () => {
				const val = reasonInput.value.trim();
				confirmBtn.disabled = val === '';
				confirmBtn.className = val
					? 'rounded bg-success hover:bg-success-hover px-6 py-1 text-base text-white'
					: 'rounded bg-gray px-6 py-1 text-base text-white cursor-not-allowed';
			});
		});

		box.querySelector('[data-cancel]')?.addEventListener('click', hide);
		box.querySelector('[data-confirm]')?.addEventListener('click', () => {
			const reasonInput = box!.querySelector<HTMLInputElement>('[data-reason]')!;
			const timeInput = box!.querySelector<HTMLInputElement>('[data-time]')!;
			onConfirm(reasonInput.value, timeInput.value);
			hide();
		});

		visible = true;
	}

	function hide() {
		box?.remove();
		box = null;
		visible = false;
	}

	function positionBox() {
		if (!box) return;

		const trigger = node.getBoundingClientRect();
		const boxRect = box.getBoundingClientRect();
		const spacing = 8;

		let top = trigger.bottom + spacing;
		let left = trigger.left + trigger.width / 2 - boxRect.width / 2;

		top = Math.min(top, window.innerHeight - boxRect.height - spacing);
		left = Math.min(left, window.innerWidth - boxRect.width - spacing);
		top = Math.max(top, spacing);
		left = Math.max(left, spacing);

		box.style.top = `${top}px`;
		box.style.left = `${left}px`;
		box.style.position = 'absolute';
	}

	function onClick(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (!visible) show();
	}

	node.addEventListener('click', onClick);

	return {
		destroy() {
			node.removeEventListener('click', onClick);
			hide();
		}
	};
}
