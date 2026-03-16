let NOISE_DATA_URL: string | null = null;

function getNoiseDataURL(size = 64): string {
	if (NOISE_DATA_URL) return NOISE_DATA_URL;
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const ctx = c.getContext('2d')!;
	const img = ctx.createImageData(size, size);
	const data = img.data;
	for (let i = 0; i < data.length; i += 4) {
		const v = Math.floor(Math.random() * 256);
		data[i] = data[i + 1] = data[i + 2] = v;
		data[i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	NOISE_DATA_URL = c.toDataURL('image/png');
	return NOISE_DATA_URL;
}

export type RippleOptions = {
	color?: string;
	opacity?: number;
	duration?: number;
	easing?: string;
	centered?: boolean;
	radius?: number;
	disabled?: boolean;
	grain?: boolean;
	grainOpacity?: number;
	grainScale?: number;
	grainBlendMode?: string;
};

export function ripple(node: HTMLElement, opts: RippleOptions = {}) {
	let options: RippleOptions = {
		color: 'currentColor',
		opacity: 0.18,
		duration: 800,
		easing: 'cubic-bezier(0.2, 0, 0, 1)',
		centered: false,
		grain: false,
		grainOpacity: 0.35,
		grainScale: 100,
		grainBlendMode: 'overlay',
		...opts
	};

	// Ensure the ripple clips inside the node
	const originalPosition = getComputedStyle(node).position;
	const needsPositionFix = originalPosition === 'static';
	if (needsPositionFix) node.style.position = 'relative';
	const originalOverflow = node.style.overflow;
	if (originalOverflow !== 'hidden') node.style.overflow = 'hidden';

	function createRipple(x: number, y: number) {
		if (options.disabled) return;
		if ((node as HTMLButtonElement).disabled) return;

		const rect = node.getBoundingClientRect();
		const localX = options.centered ? rect.width / 2 : x - rect.left;
		const localY = options.centered ? rect.height / 2 : y - rect.top;

		// radius large enough to cover from click point to farthest corner
		const maxX = Math.max(localX, rect.width - localX);
		const maxY = Math.max(localY, rect.height - localY);
		const defaultRadius = Math.sqrt(maxX * maxX + maxY * maxY);
		const radius = options.radius ?? defaultRadius;

		const el = document.createElement('span');
		el.style.position = 'absolute';
		el.style.left = `${localX - radius}px`;
		el.style.top = `${localY - radius}px`;
		el.style.width = `${radius * 2}px`;
		el.style.height = `${radius * 2}px`;
		el.style.borderRadius = '50%';
		el.style.pointerEvents = 'none';
		el.style.background = options.color!;
		el.style.opacity = String(options.opacity);
		el.style.transform = 'scale(0)';
		el.style.willChange = 'transform, opacity';
		el.style.zIndex = '0';
		node.appendChild(el);

		// Optional grain overlay
		let noiseEl: HTMLSpanElement | null = null;
		if (options.grain) {
			noiseEl = document.createElement('span');
			noiseEl.style.position = 'absolute';
			noiseEl.style.inset = '0';
			noiseEl.style.pointerEvents = 'none';
			noiseEl.style.backgroundImage = `url(${getNoiseDataURL()})`;
			noiseEl.style.backgroundRepeat = 'repeat';
			noiseEl.style.backgroundSize = `${options.grainScale}% ${options.grainScale}%`;
			noiseEl.style.opacity = String(options.grainOpacity);
			noiseEl.style.mixBlendMode = options.grainBlendMode || 'overlay';
			el.appendChild(noiseEl);
		}

		const anim = el.animate(
			[
				{ transform: 'scale(0)', opacity: options.opacity },
				{ transform: 'scale(1)', opacity: 0 }
			],
			{ duration: options.duration, easing: options.easing, fill: 'forwards' }
		);

		anim.onfinish = () => el.remove();
		anim.oncancel = () => el.remove();
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return; // ignore right/middle
		createRipple(e.clientX, e.clientY);
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			const rect = node.getBoundingClientRect();
			createRipple(rect.left + rect.width / 2, rect.top + rect.height / 2);
		}
	}

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('keydown', onKeyDown);

	return {
		update(newOpts: RippleOptions = {}) {
			options = { ...options, ...newOpts };
		},
		destroy() {
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('keydown', onKeyDown);
			if (needsPositionFix) node.style.position = '';
			if (originalOverflow !== 'hidden') node.style.overflow = originalOverflow;
		}
	};
}
