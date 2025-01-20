<script>
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/userStore';

	$: currentUser = $user;

	async function handleLogout() {
		await fetch('/api/logout', { method: 'POST' });
		user.set(null);
		goto('/login');
	}
</script>

<main>
	{#if currentUser}
		<h1>Welcome, {currentUser.firstname}!</h1>
		<p>Email: {currentUser.email}</p>
		<button on:click={handleLogout}>Logout</button>
	{:else}
		<p>Loading user data...</p>
	{/if}
</main>
