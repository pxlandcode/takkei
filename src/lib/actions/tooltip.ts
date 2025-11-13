import { tick } from 'svelte';

/** Params for the tooltip action. */
export interface TooltipParams {
	content: string | undefined;
	preferred?: 'bottom' | 'top' | 'left' | 'right';
	delay?: number;
	clickable?: boolean;
}

export function tooltip(node: HTMLElement, params: TooltipParams | null = null) {
	let tooltipEl: HTMLDivElement | null = null;
	let arrowEl: HTMLDivElement | null = null;

	let visible = false;
	let showTimer: ReturnType<typeof setTimeout> | null = null;
	let content = '';
	let preferred: TooltipParams['preferred'] = 'bottom';
	let delay = 0;
	let clickable = false;
	let enabled = false;

	// Event Handlers
	function onMouseEnter() {
		if (!enabled) return;

		// Show tooltip on hover if not already visible
		if (!visible) {
			showTimer = setTimeout(() => {
				show();
			}, delay);
		}
	}

	function onMouseLeave() {
		if (showTimer) {
			clearTimeout(showTimer);
			showTimer = null;
		}

		// Always hide on mouseleave if tooltip is visible
		if (visible) {
			hide();
		}
	}

	function onClick(event: Event) {
		if (!enabled) return;

		event.stopPropagation();
		// Toggle tooltip on click
		visible ? hide() : show();
	}

	function onOutsideClick(event: Event) {
		// Hide if click is outside the tooltip element
		if (tooltipEl && !tooltipEl.contains(event.target as Node)) {
			hide();
		}
	}

	// Show Tooltip
	function show() {
		if (!enabled) return;

		visible = true;
		createTooltip();
		// If tooltip is meant to be clickable, listen for outside clicks
		if (clickable) {
			document.addEventListener('click', onOutsideClick);
		}
	}

	// Hide Tooltip
	function hide() {
		if (showTimer) {
			clearTimeout(showTimer);
			showTimer = null;
		}

		visible = false;
		removeTooltip();
		document.removeEventListener('click', onOutsideClick);
	}

	// Create Tooltip
	async function createTooltip() {
		if (!visible || tooltipEl) return;

		tooltipEl = document.createElement('div');
		tooltipEl.className =
			'fixed z-50 transition-opacity duration-100 opacity-0 pointer-events-auto';
		tooltipEl.innerHTML = `
      <div class="relative bg-white text-black px-2 py-1 rounded-sm shadow-lg border border-black max-w-sm z-20">
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

	// Remove Tooltip
	function removeTooltip() {
		if (tooltipEl) {
			tooltipEl.remove();
			tooltipEl = null;
			arrowEl = null;
		}
	}

	// Position Tooltip (with clamping)
	function positionTooltip() {
		if (!tooltipEl) return;

		const margin = 8;
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

		// --- Clamp so the tooltip doesn't overflow the viewport ---
		// Clamp horizontally
		if (left < margin) {
			left = margin;
		} else if (left + tooltipRect.width > window.innerWidth - margin) {
			left = window.innerWidth - margin - tooltipRect.width;
		}

		// Clamp vertically
		if (top < margin) {
			top = margin;
		} else if (top + tooltipRect.height > window.innerHeight - margin) {
			top = window.innerHeight - margin - tooltipRect.height;
		}
		// ----------------------------------------------------------

		tooltipEl.style.top = `${top}px`;
		tooltipEl.style.left = `${left}px`;

		positionArrow(finalPos);
	}

	// Determines Best Position
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
				// Enough space below for entire tooltip
				return anchorRect.bottom + tipRect.height + margin <= window.innerHeight;
			case 'top':
				// Enough space above
				return anchorRect.top - tipRect.height - margin >= 0;
			case 'right':
				// Enough space on the right
				return anchorRect.right + tipRect.width + margin <= window.innerWidth;
			case 'left':
				// Enough space on the left
				return anchorRect.left - tipRect.width - margin >= 0;
		}
		return false;
	}

	// Position Arrow
	function positionArrow(finalPos: 'bottom' | 'top' | 'right' | 'left') {
		if (!arrowEl) return;

		// Reset arrow styles
		arrowEl.className = 'absolute w-0 h-0';
		arrowEl.style.borderLeft = '0.4rem solid transparent';
		arrowEl.style.borderRight = '0.4rem solid transparent';
		arrowEl.style.top = '';
		arrowEl.style.bottom = '';
		arrowEl.style.left = '';
		arrowEl.style.right = '';
		arrowEl.style.borderTop = '';
		arrowEl.style.borderBottom = '';
		arrowEl.style.borderLeft = '';
		arrowEl.style.borderRight = '';

		switch (finalPos) {
			case 'bottom':
				arrowEl.style.bottom = '-0.4rem';
				arrowEl.style.left = '50%';
				arrowEl.style.transform = 'translateX(-50%)';
				arrowEl.style.borderTop = '0.4rem solid black';
				break;
			case 'top':
				arrowEl.style.top = '-0.4rem';
				arrowEl.style.left = '50%';
				arrowEl.style.transform = 'translateX(-50%)';
				arrowEl.style.borderBottom = '0.4rem solid black';
				break;
			case 'right':
				arrowEl.style.left = '-0.4rem';
				arrowEl.style.top = '50%';
				arrowEl.style.transform = 'translateY(-50%)';
				arrowEl.style.borderLeft = '0.4rem solid black';
				break;
			case 'left':
				arrowEl.style.right = '-0.4rem';
				arrowEl.style.top = '50%';
				arrowEl.style.transform = 'translateY(-50%)';
				arrowEl.style.borderRight = '0.4rem solid black';
				break;
		}
	}

	function applyParams(newParams?: TooltipParams | null) {
		content = newParams?.content ?? '';
		preferred = newParams?.preferred ?? 'bottom';
		delay = newParams?.delay ?? 0;
		clickable = newParams?.clickable ?? false;
		enabled = Boolean(content && content.trim().length > 0);

		if (!enabled) {
			hide();
		}
	}

	applyParams(params);

	// Attach Events
	node.addEventListener('mouseenter', onMouseEnter);
	node.addEventListener('mouseleave', onMouseLeave);
	node.addEventListener('click', onClick);

	function update(newParams?: TooltipParams | null) {
		applyParams(newParams);
	}

	function destroy() {
		node.removeEventListener('mouseenter', onMouseEnter);
		node.removeEventListener('mouseleave', onMouseLeave);
		node.removeEventListener('click', onClick);
		removeTooltip();
	}

	return { update, destroy };
}
