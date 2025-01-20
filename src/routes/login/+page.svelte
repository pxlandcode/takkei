<script>
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/userStore';

	let email = '';
	let password = '';
	let errorMessage = '';
	let rememberMe = false;

	user.subscribe((value) => {});

	async function handleLogin() {
		try {
			const response = await fetch('/api/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || 'Login failed');
			}

			// Update the user store
			user.set(data.user);

			// Redirect to dashboard
			goto('/dashboard');
		} catch (error) {
			errorMessage = error.message;
		}
	}
</script>

<main class="flex min-h-screen flex-col items-center justify-center">
	<div class="w-full max-w-md rounded-md bg-white p-8 shadow-lg">
		<h1 class="mb-6 text-center text-2xl font-bold">Logga in</h1>
		<form on:submit|preventDefault={handleLogin}>
			<div class="mb-4">
				<label for="email" class="block text-gray-700">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					class="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
					placeholder="email@takkei.se"
					required
				/>
			</div>
			<div class="mb-4">
				<label for="password" class="block text-gray-700">Lösenord</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					class="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
					placeholder="Lösenord"
					required
				/>
			</div>
			<div class="mb-6 flex items-center">
				<input id="rememberMe" type="checkbox" bind:checked={rememberMe} class="mr-2" />
				<label for="rememberMe" class="text-gray-700">Håll mig inloggad</label>
			</div>
			<button
				type="submit"
				class="w-full rounded-md bg-green-500 py-2 font-semibold text-white hover:bg-green-600 focus:outline-none"
			>
				Logga in
			</button>
		</form>
		{#if errorMessage}
			<p class="mt-4 text-center text-red-500">{errorMessage}</p>
		{/if}
	</div>
</main>
