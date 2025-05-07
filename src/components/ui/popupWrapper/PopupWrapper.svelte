<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import IconButton from '../../bits/icon-button/IconButton.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';

	export let header: string = 'Popup';
	export let width: string = 'fit-content';
	export let height: string = 'fit-content';

	export let icon: string;

	const dispatch = createEventDispatcher();

	function onClose() {
		dispatch('close');
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeyDown);
	});

	let mouseDownInside = false;

	function handleMouseDown(event: MouseEvent) {
		const target = event.target as HTMLElement;
		mouseDownInside = popupElement?.contains(target);
	}

	function handleMouseUp(event: MouseEvent) {
		const target = event.target as HTMLElement;
		const mouseUpInside = popupElement?.contains(target);

		if (!mouseDownInside && !mouseUpInside) {
			onClose();
		}
	}

	let popupElement: HTMLElement;
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
	role="backdrop"
	on:mousedown={handleMouseDown}
	on:mouseup={handleMouseUp}
>
	<div
		bind:this={popupElement}
		class="modal-content overflow-visible rounded-lg bg-white shadow-lg transition-all"
		on:click|stopPropagation
		style="width: {width}; height: {height};"
	>
		<div class="p-4">
			<div class="header flex items-center justify-between border-b-2 pb-2">
				<div class="ml-3 flex items-center gap-2">
					{#if icon}
						<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
							<Icon {icon} size="14px" />
						</div>
					{/if}
					<h2 class="text-3xl font-semibold text-black text-text" id="popup-title">{header}</h2>
				</div>
				<IconButton on:click={onClose} size="18px" icon="Close" transparent />
			</div>
			<div class="popup-scroll max-h-[80dvh] overflow-scroll p-4">
				<slot />
			</div>
		</div>
	</div>
</div>

<style>
	.modal-content {
		max-width: 90vw;
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
