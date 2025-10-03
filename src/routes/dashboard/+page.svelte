<script lang="ts">
	import { goto } from '$app/navigation';
	import { sendMail } from '$lib/services/mail/mailClientService';
	import { user } from '$lib/stores/userStore';

	$: currentUser = $user;

	async function handleLogout() {
		await fetch('/api/logout', { method: 'POST' });
		user.set(null);
		goto('/login');
	}

	const payload = {
		to: 'pierre.elmen@gmail.com',
		subject: 'Sending with SvelteKit is Fun',
		text: 'and easy to do anywhere, even with SvelteKit',
		html: '<strong>and easy to do anywhere, even with SvelteKit</strong>'
	};

	let status: 'idle' | 'sending' | 'sent' | 'error' = 'idle';

	async function sendTestMail() {
		try {
			status = 'sending';

			await sendMail({
				to: ['pierre.elmen@gmail.com'],
				subject: 'Veckans nyheter från Takkei',
				header: 'Vad är nytt?',
				subheader: 'Höstens träningsupplägg',
				body: `Vi har lagt till nya pass, förbättrat din kalender och introducerat nya övningar.`
			});

			status = 'sent';
		} catch (e) {
			console.error(e);
			status = 'error';
		}
	}
</script>

<div class="flex w-full p-8">
	{#if currentUser}
		<h1>Welcome, {currentUser.firstname}!</h1>
		<p>Email: {currentUser.email}</p>
		<button on:click={handleLogout}>Logout</button>
	{:else}
		<p>Loading user data...</p>
	{/if}

	<button
		class="rounded-sm bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
		disabled={status === 'sending'}
		on:click={sendTestMail}
	>
		{#if status === 'sending'}
			Sending…
		{:else if status === 'sent'}
			Sent ✅
		{:else if status === 'error'}
			Try again ❌
		{:else}
			Send test email
		{/if}
	</button>
</div>
