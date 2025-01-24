import { tick } from 'svelte';

/** Params for the tooltip action. */
export interface TooltipParams {
	content: string | undefined;
	preferred?: 'bottom' | 'top' | 'left' | 'right';
	/** Delay (ms) before showing the tooltip on hover. Default = 0. */
	delay?: number;
}

export function tooltip(node: HTMLElement, params: TooltipParams) {
	let tooltipEl: HTMLDivElement | null = null;
	let arrowEl: HTMLDivElement | null = null;

	let visible = false;
	let showTimer: ReturnType<typeof setTimeout> | null = null;

	let content = params.content ?? '';
	let preferred = params.preferred ?? 'bottom';
	let delay = params.delay ?? 0;

	function onMouseEnter() {
		showTimer = setTimeout(() => {
			show();
		}, delay);
	}

	function onMouseLeave() {
		if (showTimer) {
			clearTimeout(showTimer);
			showTimer = null;
		}
		hide();
	}

	function show() {
		visible = true;
		createTooltip();
	}

	function hide() {
		visible = false;
		removeTooltip();
	}

	async function createTooltip() {
		if (!visible || tooltipEl) return;

		tooltipEl = document.createElement('div');
		tooltipEl.className =
			'fixed pointer-events-none z-50 transition-opacity duration-100 ' + 'opacity-0'; // We'll fade in via opacity below

		tooltipEl.innerHTML = `
      <div class="relative bg-blue text-white px-2 py-1 rounded shadow max-w-sm">
      
        <div id="tooltip-arrow" class="absolute w-0 h-0"></div>
      
        <div>${content}</div>
      </div>
    `;

		document.body.appendChild(tooltipEl);

		arrowEl = tooltipEl.querySelector('#tooltip-arrow') as HTMLDivElement;

		await tick();
		positionTooltip();

		tooltipEl.style.opacity = '1';
	}

	function removeTooltip() {
		if (tooltipEl) {
			tooltipEl.remove();
			tooltipEl = null;
			arrowEl = null;
		}
	}

	function positionTooltip() {
		if (!tooltipEl) return;

		const margin = 8; // Gap between anchor and tooltip
		const anchorRect = node.getBoundingClientRect();
		const tooltipRect = tooltipEl.getBoundingClientRect();

		const finalPos = getBestPosition(anchorRect, tooltipRect, preferred, margin);

		let top = 0;
		let left = 0;
		switch (finalPos) {
			case 'bottom':
				top = anchorRect.bottom + margin;
				left = anchorRect.left + (anchorRect.width - tooltipRect.width) / 2;
				break;
			case 'top':
				top = anchorRect.top - tooltipRect.height - margin;
				left = anchorRect.left + (anchorRect.width - tooltipRect.width) / 2;
				break;
			case 'right':
				top = anchorRect.top + (anchorRect.height - tooltipRect.height) / 2;
				left = anchorRect.right + margin;
				break;
			case 'left':
				top = anchorRect.top + (anchorRect.height - tooltipRect.height) / 2;
				left = anchorRect.left - tooltipRect.width - margin;
				break;
		}

		tooltipEl.style.top = `${top}px`;
		tooltipEl.style.left = `${left}px`;

		positionArrow(finalPos);
	}

	function getBestPosition(
		anchorRect: DOMRect,
		tooltipRect: DOMRect,
		pref: string,
		margin: number
	): 'bottom' | 'top' | 'right' | 'left' {
		const fallbackOrder = [...new Set([pref, 'bottom', 'top', 'right', 'left'])];
		for (const pos of fallbackOrder) {
			if (canPlace(pos, anchorRect, tooltipRect, margin)) {
				return pos as 'bottom' | 'top' | 'right' | 'left';
			}
		}
		return 'bottom';
	}

	function canPlace(position: string, anchorRect: DOMRect, tipRect: DOMRect, margin: number) {
		switch (position) {
			case 'bottom':
				return anchorRect.bottom + tipRect.height + margin <= window.innerHeight;
			case 'top':
				return anchorRect.top - tipRect.height - margin >= 0;
			case 'right':
				return anchorRect.right + tipRect.width + margin <= window.innerWidth;
			case 'left':
				return anchorRect.left - tipRect.width - margin >= 0;
		}
		return false;
	}

	function positionArrow(finalPos: 'bottom' | 'top' | 'right' | 'left') {
		if (!arrowEl) return;

		arrowEl.className = 'absolute w-0 h-0';

		arrowEl.style.borderLeft = '0.4rem solid transparent';
		arrowEl.style.borderRight = '0.4rem solid transparent';
		arrowEl.style.borderTop = '0';
		arrowEl.style.borderBottom = '0';

		switch (finalPos) {
			case 'bottom':
				arrowEl.style.bottom = '100%';
				arrowEl.style.left = '50%';
				arrowEl.style.transform = 'translateX(-50%)';
				arrowEl.style.borderBottom = '0.4rem solid rgb(59,130,246)';
				break;
			case 'top':
				arrowEl.style.top = '100%';
				arrowEl.style.left = '50%';
				arrowEl.style.transform = 'translateX(-50%)';
				arrowEl.style.borderTop = '0.4rem solid rgb(59,130,246)';
				break;
			case 'right':
				arrowEl.style.left = '0';
				arrowEl.style.top = '50%';
				arrowEl.style.transform = 'translate(-100%, -50%)';
				arrowEl.style.borderLeft = '0.4rem solid rgb(59,130,246)';
				break;
			case 'left':
				arrowEl.style.right = '0';
				arrowEl.style.top = '50%';
				arrowEl.style.transform = 'translate(100%, -50%)';
				arrowEl.style.borderRight = '0.4rem solid rgb(59,130,246)';
				break;
		}
	}

	node.addEventListener('mouseenter', onMouseEnter);
	node.addEventListener('mouseleave', onMouseLeave);

	function update(newParams: TooltipParams) {
		content = newParams.content;
		preferred = newParams.preferred ?? 'bottom';
		delay = newParams.delay ?? 0;

		if (visible && tooltipEl) {
			const textDiv = tooltipEl.querySelector('div div:last-child');
			if (textDiv) textDiv.textContent = content;
			positionTooltip();
		}
	}

	function destroy() {
		node.removeEventListener('mouseenter', onMouseEnter);
		node.removeEventListener('mouseleave', onMouseLeave);
		removeTooltip();
	}

	return { update, destroy };
}
