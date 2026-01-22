<script lang="ts">
	import { minimizedPopups, restorePopup, removeMinimizedPopup } from '$lib/stores/popupStore';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import { fly, fade } from 'svelte/transition';
	import IconButton from '../../bits/icon-button/IconButton.svelte';

	let showList = false;

	$: count = $minimizedPopups.length;

	function toggleList() {
		showList = !showList;
	}

	function onRestore(id: string) {
		restorePopup(id);
		if ($minimizedPopups.length === 0) {
			showList = false;
		}
	}

	function onClose(id: string, e: MouseEvent) {
		e.stopPropagation();
		removeMinimizedPopup(id);
		if ($minimizedPopups.length === 0) {
			showList = false;
		}
	}
</script>

{#if count > 0}
	<div class="fixed bottom-4 left-4 z-50">
		{#if showList}
			<div
				class="mb-2 flex flex-col gap-2 rounded-lg bg-white p-2 shadow-xl"
				transition:fly={{ y: 20, duration: 200 }}
			>
				{#each $minimizedPopups as popup (popup.id)}
					<button
						class="group flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-left transition-colors hover:bg-gray-100"
						on:click={() => onRestore(popup.id)}
					>
						<div class="flex items-center gap-2">
							{#if popup.icon}
								<div
									class="bg-text flex h-6 w-6 items-center justify-center rounded-full text-white"
								>
									<Icon icon={popup.icon} size="12px" />
								</div>
							{/if}
							<span class="text-sm font-medium">{popup.header ?? 'Popup'}</span>
						</div>
						<div class="opacity-0 transition-opacity group-hover:opacity-100">
							<IconButton
								icon="Close"
								size="14px"
								transparent
								on:click={(e) => onClose(popup.id, e)}
							/>
						</div>
					</button>
				{/each}
			</div>
		{/if}

		<button
			class="glass relative flex h-[96px] w-[96px] cursor-pointer items-center justify-center rounded-sm transition duration-200 hover:bg-white/20 active:translate-y-1 active:scale-95"
			on:click={toggleList}
			transition:fade={{ duration: 200 }}
			aria-label="Minimized popups"
		>
			<Icon icon="Windows" size="35px" color="white" />
			{#if count > 0}
				<span
					class="bg-notification absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold text-white"
				>
					{count}
				</span>
			{/if}
		</button>
	</div>
{/if}
