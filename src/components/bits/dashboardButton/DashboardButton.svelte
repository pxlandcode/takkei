<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '../icon-component/Icon.svelte';

	export let label: string;
	export let icon: string;
	export let href: string = '#'; // Default path
	export let notificationCount: number = 0;

	// Handle navigation
	function navigate() {
		if (href && href !== '#') {
			goto(href);
		}
	}
</script>

<div class="relative inline-block">
	<button
		on:click={navigate}
		class="glass flex h-[96px] w-[96px] cursor-pointer flex-col items-center justify-center gap-3 rounded-sm transition duration-200 hover:bg-white/20 active:translate-y-1 active:scale-95"
		aria-label={label}
	>
		<Icon {icon} size="35px" color="white" />
		<p class="text-xxs font-medium text-white">{label}</p>
	</button>

	{#if notificationCount > 0}
		<span
			class="bg-notification absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold text-white"
		>
			{notificationCount}
		</span>
	{/if}
</div>
