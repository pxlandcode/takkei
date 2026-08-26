<script lang="ts">
	import Button from '../../components/bits/button/Button.svelte';
	import SlideShow from '../../components/bits/slideshow/SlideShow.svelte';
	import LoadingOverlay from '../../components/ui/loadingOverlay/LoadingOverlay.svelte';

	const slides = [
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

<main class="flex h-dvh bg-black">
	<div
		class="mm:block relative m-5 hidden max-w-4xl flex-1 gap-5 overflow-hidden rounded-sm bg-black text-white"
	>
		<div class="absolute z-10 flex w-full items-center justify-between p-4 md:p-6">
			<img src="/images/takkei-logo.png" alt="Takkei Logo" class="h-12 md:h-20" />
			<Button text="Till vår hemsida" iconRight="GoTo" on:click={goToTakkeiWebsite} />
		</div>

		<SlideShow {slides} intervalTime={10000} />
	</div>

	<div class="mx-auto w-full overflow-y-auto p-6 text-white md:w-[35rem]">
		<slot />
	</div>
</main>

<LoadingOverlay />
