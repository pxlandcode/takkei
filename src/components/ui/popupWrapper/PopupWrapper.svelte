<script lang="ts">
	import { createEventDispatcher, onDestroy, tick } from 'svelte';
	import IconButton from '../../bits/icon-button/IconButton.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import { fly, type FlyParams } from 'svelte/transition';
	import { expoInOut } from 'svelte/easing';

	export let header = 'Popup';
	export let width = 'fit-content';
	export let height = 'fit-content';
	export let noClose = false;
	export let icon: string | undefined;

	export let variant: 'modal' | 'right' | 'left' | 'top' | 'bottom' = 'modal';
	export let open = true;
	export let dismissable = true;

	const dispatch = createEventDispatcher();
	let dialogEl: HTMLDialogElement;
	let mounted = false;

	function closeFromUser() {
		open = false;
		dispatch('close');
	}

	function onCancel(e: Event) {
		e.preventDefault();
		if (!noClose) closeFromUser();
	}

	function onDialogClick(e: MouseEvent) {
		// backdrop click is when target === dialog element
		if (noClose || !dismissable) return;
		if (e.target === dialogEl) closeFromUser();
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
		const base = 'bg-white shadow-lg overflow-visible max-h-[80dvh] md:rounded-2xl w-full';
		const modalSize = `md:w-[min(66vw,900px)]`;
		const drawerBase = 'min-h-screen md:min-h-[unset]';
		const byVar: Record<typeof variant, string> = {
			modal: `${modalSize}`,
			right: `${drawerBase} md:w-[32vw] md:rounded-l-2xl justify-self-end`,
			left: `${drawerBase} md:w-[32vw] md:rounded-r-2xl justify-self-start`,
			top: `w-full md:rounded-b-2xl self-start`,
			bottom: `w-full md:rounded-t-2xl self-end`
		};
		return `${base} ${byVar[variant]}`;
	}

	// Apply explicit width/height for modal only
	$: sizeStyle = variant === 'modal' ? `width:${width};height:${height};` : '';

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
				<div class="flex items-center justify-between border-b-2 px-6 py-4">
					<div class="ml-1 flex items-center gap-2">
						{#if icon}
							<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
								<Icon {icon} size="14px" />
							</div>
						{/if}
						<h2 class="text-2xl font-semibold text-text md:text-3xl">{header}</h2>
					</div>
					{#if !noClose}
						<IconButton on:click={closeFromUser} size="18px" icon="Close" transparent />
					{/if}
				</div>

				<div class="popup-scroll p-6">
					<slot />
				</div>
			</div>
		{/if}
	</dialog>
{/if}

<style>
	/* Dialog fills viewport, centers content with grid */
	.popup-dialog {
		padding: 0;
		border: none;
		width: 100vw;
		height: 100vh;
		background: transparent;
		display: grid;
		place-items: center; /* centers modal variant; drawers use self-start/end */
		padding: 1rem;
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

	/* Scrollbar styling */
	.popup-scroll {
		max-height: calc(80dvh - 2rem);
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
</style>
