<script lang="ts">
	import SlideShow from '../../components/bits/slideshow/SlideShow.svelte';
	import LoginForm from '../../components/ui/loginForm/LoginForm.svelte';

	let slides = [
		{
			image: '/images/neck.png',
			lines: ['En timme i veckan', 'Hela kroppen', 'Repetera']
		},
		{
			image: '/images/leaves.png',
			lines: ['Kontinuitet är nyckeln', 'till träningsframgång']
		},
		{
			image: '/images/sand-wall.png',
			lines: ['Smärtfri', 'Smidig', 'Stark', 'Snabb', '(Snygg)']
		}
	];

	let email = '';
	let password = '';
	let errorMessage = '';
	let rememberMe = false;

	// Helper that removes all cookies so stubborn login data does not block users.
	const clearCookies = () => {
		if (typeof document === 'undefined' || typeof window === 'undefined') {
			return;
		}

		const cookies = document.cookie ? document.cookie.split(';') : [];
		const hostname = window.location.hostname;
		const hostParts = hostname.split('.');
		const domainVariants = [hostname];

		if (hostParts.length > 1) {
			domainVariants.push(`.${hostParts.slice(-2).join('.')}`);
		}

		for (const cookie of cookies) {
			const eqPos = cookie.indexOf('=');
			const name = eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
			if (!name) continue;
			document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
			for (const domain of domainVariants) {
				document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${domain}`;
			}
		}

		window.location.reload();
	};

	const handleClearCookies = () => {
		clearCookies();
	};
</script>

<!-- Fullscreen Container -->
<div class="flex h-dvh w-full items-center justify-center bg-black">
	<!-- Slideshow Container with Padding and Rounded Edges -->
	<div class="wrapper relative overflow-hidden rounded-sm">
		<SlideShow {slides} intervalTime={10000} />

		<!-- Logo Positioned at the Top -->
		<div class="absolute top-8 left-8">
			<img src="/images/takkei-logo.png" alt="Takkei Logo" class="h-16 md:h-20" />
		</div>

		<!-- Centered Login Form -->
		<div class="absolute inset-0 flex items-center justify-center">
			<LoginForm bind:email bind:password bind:errorMessage bind:rememberMe />
		</div>
	</div>
</div>

<div
	class="fixed right-4 bottom-4 z-10 w-[280px] rounded-sm border border-gray-200 bg-white/95 p-4 text-sm text-gray-900 shadow-xl backdrop-blur"
>
	<p class="mb-2 font-semibold">Problem att logga in?</p>
	<p class="mb-3 text-gray-600">
		Vi har uppdaterat inloggningen och gamla kakor kan göra att du fastnar. Rensa kakorna här och
		försök igen.
	</p>
	<button
		class="w-full rounded-xl bg-black px-4 py-2 text-white transition hover:bg-gray-900 active:translate-y-px"
		on:click={handleClearCookies}
	>
		Rensa kakor
	</button>
</div>

<style>
	.wrapper {
		width: calc(100% - 2rem);
		height: calc(100% - 2rem);
	}
</style>
