<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { loadingStore } from '$lib/stores/loading';

	let loadingText = 'Något tar längre tid än väntat...';
	let timer: ReturnType<typeof setTimeout> | null = null;
	let unsubscribe: (() => void) | null = null;

	function startTimer() {
		stopTimer(); // clear any existing timer
		timer = setTimeout(() => {
			if ($loadingStore.isSlowlyLoading) {
				loadingText = 'Tack för ditt tålamod...';
			}
		}, 8000);
	}

	function stopTimer() {
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
	}

	onMount(() => {
		unsubscribe = loadingStore.subscribe((value) => {
			if (value.isSlowlyLoading) {
				if (!timer) {
					startTimer();
				}
			} else {
				stopTimer();
			}
		});
	});

	onDestroy(() => {
		unsubscribe?.();
		stopTimer();
	});
</script>

{#if $loadingStore.isSlowlyLoading}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
		<div
			class="flex h-96 w-[550px] flex-col items-center justify-center gap-2 rounded-xl bg-white/95 text-black shadow-xl"
		>
			<svg width="38" height="38" viewBox="0 0 38 38" stroke="black">
				<g fill="none" fill-rule="evenodd">
					<g transform="translate(1 1)" stroke-width="2">
						<circle stroke-opacity=".5" cx="18" cy="18" r="18" />

						<path d="M36 18c0-9.94-8.06-18-18-18">
							<animateTransform
								attributeName="transform"
								type="rotate"
								from="0 18 18"
								to="360 18 18"
								dur="1s"
								repeatCount="indefinite"
							/>
						</path>
					</g>
				</g>
			</svg>
			<h3 class="pt-4 text-xl">{loadingText}</h3>
			<p class="pt-4 text-sm">{$loadingStore.loadingText}</p>
		</div>
	</div>
{/if}
