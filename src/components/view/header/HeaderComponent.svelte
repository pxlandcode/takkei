<script lang="ts">
	import { user } from '$lib/stores/userStore';
	import { onDestroy } from 'svelte';

	let currentUser = null;

	// Subscribe to the user store
	const unsubscribe = user.subscribe((value) => {
		currentUser = value;
	});

	// Cleanup on destroy
	onDestroy(() => {
		unsubscribe();
	});

	export let onLogout = () => {};
</script>

<header class="bg-gray-800 text-white">
	<div class="container mx-auto flex items-center justify-between px-6 py-4">
		<div class="flex items-center">
			<img src="/img/takkei-white.svg" alt="Takkei Logo" class="mr-4 h-8" />
		</div>

		{#if currentUser}
			<div class="flex items-center space-x-4">
				<div class="flex items-center space-x-2">
					<span>{currentUser.firstname} {currentUser.lastname}</span>
				</div>
				<button
					class="flex items-center space-x-2 rounded-md border border-white bg-transparent px-3 py-1 text-white hover:bg-gray-700"
				>
					<span class="material-icons">Kalender</span>
				</button>
				<button
					class="rounded-md border border-white bg-transparent px-3 py-1 text-white hover:bg-gray-700"
					on:click={onLogout}
				>
					Logga ut
				</button>
			</div>
		{/if}
	</div>
</header>
