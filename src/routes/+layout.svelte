<script lang="ts">
	import { i18n } from '$lib/i18n';
	import { ParaglideJS } from '@inlang/paraglide-sveltekit';
	import { user } from '$lib/stores/userStore';
	import { page } from '$app/stores';
	import '../app.css';
	import HeaderComponent from '../components/view/header/HeaderComponent.svelte';
	import LoadingOverlay from '../components/ui/loadingOverlay/LoadingOverlay.svelte';
	import Dashboard from '../components/view/dashboard/Dashboard.svelte';

	export let data;

	$user = data.user;

	$: currentRoute = $page.url.pathname;

	function handleLogout() {
		fetch('/api/logout', { method: 'POST' }).then(() => {
			// Clear the user store
			user.set(null);

			// Redirect to login page
			window.location.href = '/login';
		});
	}
</script>

<ParaglideJS {i18n}>
	{#if currentRoute === '/login'}
		<slot />
	{:else}
		<div class="flex flex-row gap-4 bg-background-gradient">
			<aside class="h-dvh w-80 p-4">
				<Dashboard />
			</aside>
			<main class=" h-dvh w-full flex-1 overflow-y-scroll p-4">
				<div class="rounded-4xl h-full w-full bg-white">
					<slot />
				</div>
			</main>
		</div>
		<LoadingOverlay />
	{/if}
</ParaglideJS>
