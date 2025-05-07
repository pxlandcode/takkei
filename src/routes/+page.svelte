<!-- +page.svelte  (or any component you like) -->
<script lang="ts">
	// optional: make subject/text reactive inputs instead of hard‑coded
	const payload = {
		to: 'pierre.elmen@gmail.com',
		subject: 'Sending with SvelteKit is Fun',
		text: 'and easy to do anywhere, even with SvelteKit',
		html: '<strong>and easy to do anywhere, even with SvelteKit</strong>'
	};

	let status: 'idle' | 'sending' | 'sent' | 'error' = 'idle';

	async function sendMail() {
		try {
			status = 'sending';

			const res = await fetch('/api/send-email', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!res.ok) throw new Error(await res.text());
			status = 'sent';
		} catch (err) {
			console.error(err);
			status = 'error';
		}
	}
</script>

<h1>Welcome to SvelteKit</h1>
<p>
	Visit
	<a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a>
	to read the documentation
</p>

<button
	class="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
	disabled={status === 'sending'}
	on:click={sendMail}
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

<style>
	/* quick utility if you’re not using Tailwind */
	button {
		transition: opacity 0.2s;
	}
</style>
