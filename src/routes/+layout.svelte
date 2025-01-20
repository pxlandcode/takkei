<script lang="ts">
	import { i18n } from '$lib/i18n';
	import { ParaglideJS } from '@inlang/paraglide-sveltekit';
	import { user } from '$lib/stores/userStore';
	import '../app.css';
	import HeaderComponent from '../components/view/header/HeaderComponent.svelte';

	export let data;

	$user = data.user;

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
	<HeaderComponent onLogout={handleLogout} />
	<main class="bg-gray-10 h-screen">
		<slot />
	</main>
</ParaglideJS>
