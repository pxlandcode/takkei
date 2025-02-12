<script lang="ts">
	import { goto } from '$app/navigation';
	import { user } from '$lib/stores/userStore';
	import type { User } from '$lib/types/userTypes';
	import Button from '../../bits/button/Button.svelte';

	export let email = '';
	export let password = '';
	export let errorMessage = '';
	export let rememberMe = false;

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

			user.set(data.user as User);
			goto('/dashboard');
		} catch (error) {
			errorMessage = error.message;
		}
	}
</script>

<div class="w-full max-w-96 p-8 text-white glass rounded-4xl">
	<form on:submit|preventDefault={handleLogin} class="space-y-4">
		<div>
			<label for="email" class="block text-white">Email</label>
			<input
				id="email"
				type="email"
				bind:value={email}
				class="w-full rounded-md border border-gray-medium bg-transparent px-4 py-2 text-white placeholder-gray-bright focus:outline-none focus:ring-2 focus:ring-primary"
				placeholder="email@takkei.se"
				required
			/>
		</div>
		<div>
			<label for="password" class="text-white">Lösenord</label>
			<input
				id="password"
				type="password"
				bind:value={password}
				class="w-full rounded-md border border-gray-medium bg-transparent px-4 py-2 text-white placeholder-gray-bright focus:outline-none focus:ring-2 focus:ring-primary"
				placeholder="Lösenord"
				required
			/>
		</div>
		<div class="flex items-center justify-between">
			<label class="flex items-center text-white">
				<input id="rememberMe" type="checkbox" bind:checked={rememberMe} class="mr-2" />
				Håll mig inloggad
			</label>
		</div>
		<Button type="submit" text="Logga in" full />
	</form>
	{#if errorMessage}
		<p class="mt-4 text-center text-red-400">{errorMessage}</p>
	{/if}
</div>
