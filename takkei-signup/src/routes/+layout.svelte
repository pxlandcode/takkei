<script lang="ts">
	import { i18n } from '$lib/i18n';
	import { ParaglideJS } from '@inlang/paraglide-sveltekit';
	import SlideShow from '../components/slideshow/SlideShow.svelte';
	import '../app.css';
	import Button from '../components/button/Button.svelte';
	import LoadingOverlay from '../components/ui/loadingOverlay/LoadingOverlay.svelte';

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

	function goToTakkeiWebsite() {
		window.open('https://www.takkeitraining.com/', '_self');
	}
</script>

<ParaglideJS {i18n}>
	<main class="flex h-dvh bg-black">
		<!-- LEFT SIDE: slideshow background & top bar -->
		<div
			class="relative m-5 hidden max-w-4xl flex-1 gap-5 overflow-hidden rounded-xl bg-black text-white mm:block"
		>
			<!-- top bar -->
			<div class="absolute z-10 flex w-full items-center justify-between p-4 md:p-6">
				<img src="/images/takkei-logo.png" alt="Takkei Logo" class="h-12 md:h-20" />
				<Button onClick={goToTakkeiWebsite}>Till vår hemsida →</Button>
			</div>

			<!-- slideshow itself -->
			<SlideShow {slides} intervalTime={10000} />
		</div>

		<!-- RIGHT SIDE: slot for child pages (e.g. sign-up form) -->
		<div class="mx-auto w-full overflow-y-auto p-6 text-white md:w-[35rem]">
			<slot />
		</div>
	</main>

	<LoadingOverlay />
</ParaglideJS>
