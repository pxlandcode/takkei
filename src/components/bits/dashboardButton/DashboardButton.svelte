<script lang="ts">
	import { goto } from '$app/navigation';
	import Icon from '../icon-component/Icon.svelte';

	export let label: string;
	export let icon: string;
	export let href: string = '#'; // Default path

	// Handle navigation
	function navigate() {
		if (href && href !== '#') {
			goto(href);
		}
	}
</script>

<button
	on:click={navigate}
	class="flex h-[94px] w-[94px] flex-col items-center justify-center gap-3 rounded-2xl transition duration-200 glass hover:bg-white/20 active:translate-y-1 active:scale-95"
	aria-label={label}
>
	<Icon {icon} size="30px" color="white" />
	<p class="text-xxs font-medium text-white">{label}</p>
</button>
