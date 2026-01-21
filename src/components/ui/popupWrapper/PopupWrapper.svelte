<script lang="ts">
	import { createEventDispatcher, onDestroy, tick } from 'svelte';
	import IconButton from '../../bits/icon-button/IconButton.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import { fly, type FlyParams } from 'svelte/transition';
	import { expoInOut } from 'svelte/easing';

	export let header = 'Popup';
	export let width = 'fit-content';
	export let height = 'fit-content';
	export let maxWidth: string | undefined;
	export let maxHeight: string | undefined;
	export let noClose = false;
	export let icon: string | undefined;

	export let variant: 'modal' | 'right' | 'left' | 'top' | 'bottom' = 'modal';
	export let open = true;
	export let dismissable = true;
	export let draggable = true;
	export let minimizable = true;
	export let initialPosition: { x: number; y: number } | undefined = undefined;

	const dispatch = createEventDispatcher();

	// Drag state
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let translateX = initialPosition?.x ?? 0;
	let translateY = initialPosition?.y ?? 0;
	let headerEl: HTMLElement;
	let dialogEl: HTMLDialogElement;
	let mounted = false;

	function closeFromUser() {
		open = false;
		dispatch('close');
	}

	function minimizeFromUser() {
		dispatch('minimize', { position: { x: translateX, y: translateY } });
	}

	function onCancel(e: Event) {
		e.preventDefault();
		if (!noClose) closeFromUser();
	}

	function onDialogClick(e: MouseEvent) {
		// backdrop click is when target === dialog element
		if (noClose || !dismissable || isDragging) return;
		if (e.target === dialogEl) closeFromUser();
	}

	// Drag handlers
	function onHeaderMouseDown(e: MouseEvent) {
		if (!draggable || variant !== 'modal') return;
		e.preventDefault();
		isDragging = true;
		dragStartX = e.clientX - translateX;
		dragStartY = e.clientY - translateY;

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	function onMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		translateX = e.clientX - dragStartX;
		translateY = e.clientY - dragStartY;
	}

	function onMouseUp() {
		isDragging = false;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	}

	function t(): FlyParams {
		const base: FlyParams = { duration: 450, easing: expoInOut, opacity: 0.2 };
		if (variant === 'right') base.x = 300;
		if (variant === 'left') base.x = -300;
		if (variant === 'top') base.y = -300;
		if (variant === 'bottom') base.y = 300;
		if (variant === 'modal') base.y = 40;
		return base;
	}

	// Size classes for container
	function containerClass() {
		const base =
			'bg-white shadow-lg flex flex-col overflow-hidden h-full md:h-auto max-h-full md:max-h-[80dvh] w-full rounded-sm ';
		const modalSize =
			'w-full max-w-full sm:max-w-[min(90vw,900px)] md:max-w-[min(66vw,900px)] sm:mx-auto';
		const drawerBase = 'min-h-screen md:min-h-[unset]';
		const byVar: Record<typeof variant, string> = {
			modal: `${modalSize}`,
			right: `${drawerBase} md:w-[32vw] md:rounded-l-sm justify-self-end`,
			left: `${drawerBase} md:w-[32vw] md:rounded-r-sm justify-self-start`,
			top: `w-full md:rounded-b-sm self-start`,
			bottom: `w-full md:rounded-t-sm self-end`
		};
		return `${base} ${byVar[variant]}`;
	}

	// Apply explicit width/height for modal only
	$: sizeStyle = (() => {
		let style = '';
		const applyWidth = width && width !== 'fit-content';
		const applyHeight = height && height !== 'fit-content';
		if (applyWidth) style += `width:${width};`;
		if (applyHeight) style += `height:${height};`;
		if (maxWidth) style += `max-width:${maxWidth};`;
		if (maxHeight) style += `max-height:${maxHeight};`;
		if (variant === 'modal' && draggable) {
			style += `transform: translate(${translateX}px, ${translateY}px);`;
		}
		return style;
	})();

	// Ensure dialog is shown when open flips true
	$: (async () => {
		if (open) {
			if (!mounted) {
				mounted = true;
				await tick(); // wait for <dialog> to mount
			}
			if (dialogEl && !dialogEl.open) {
				dialogEl.showModal();
			}
		}
	})();

	onDestroy(() => {
		try {
			dialogEl?.close();
		} catch {}
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	});
</script>

{#if mounted}
	<dialog bind:this={dialogEl} class="popup-dialog" on:click={onDialogClick} on:cancel={onCancel}>
		{#if open}
			<div
				class={containerClass()}
				style={sizeStyle}
				transition:fly={t()}
				on:introstart={() => {
					if (dialogEl && !dialogEl.open) dialogEl.showModal();
				}}
				on:outroend={() => {
					try {
						dialogEl?.close();
					} finally {
						mounted = false;
					}
				}}
			>
				<div
					bind:this={headerEl}
					class="flex items-center justify-between border-b-2 px-6 py-4"
					class:cursor-move={draggable && variant === 'modal'}
					on:mousedown={onHeaderMouseDown}
					role="banner"
				>
					<div class="ml-1 flex items-center gap-2">
						{#if icon}
							<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
								<Icon {icon} size="14px" />
							</div>
						{/if}
						<h2 class="text-text text-2xl font-semibold md:text-3xl">{header}</h2>
					</div>
					<div class="flex items-center gap-1">
						<!-- {#if minimizable}
							<IconButton on:click={minimizeFromUser} size="18px" icon="Minimize" transparent />
						{/if} -->
						{#if !noClose}
							<IconButton on:click={closeFromUser} size="18px" icon="Close" transparent />
						{/if}
					</div>
				</div>

				<div class="popup-scroll p-6">
					<slot />
				</div>

				<div class="popup-footer" aria-hidden="true"></div>
			</div>
		{/if}
	</dialog>
{/if}

<style>
	/* Dialog fills viewport, centers content with grid */
	.popup-dialog {
		padding: 0;
		border: none;
		box-sizing: border-box;
		position: fixed;
		inset: 0;
		margin: 0;
		width: 100vw;
		height: 100vh;
		height: 100dvh;
		max-width: none;
		max-height: none;
		background: transparent;
		display: grid;
		align-items: stretch;
		justify-items: stretch;
	}
	@media (min-width: 640px) {
		.popup-dialog {
			padding: 1rem;
			place-items: center; /* recentre modal on larger viewports */
		}
	}
	.popup-dialog::backdrop {
		background: rgba(0, 0, 0, 0.5);
		animation: dialog-backdrop 150ms ease-out both;
	}
	@keyframes dialog-backdrop {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.cursor-move {
		cursor: move;
		user-select: none;
	}

	/* Scrollbar styling */
	.popup-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}
	.popup-scroll {
		scrollbar-width: thin;
		scrollbar-color: darkgray transparent;
	}
	.popup-scroll::-webkit-scrollbar {
		width: 8px;
	}
	.popup-scroll::-webkit-scrollbar-track {
		background: black;
	}
	.popup-scroll::-webkit-scrollbar-thumb {
		background-color: darkgray;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}
	.popup-scroll::-webkit-scrollbar-thumb:hover {
		background-color: #a9a9a9;
	}

	.popup-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid rgba(0, 0, 0, 0.1);
		background: #ffffff;
	}
</style>
