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
</script>

<!-- Fullscreen Container -->
<div class="flex h-dvh w-full items-center justify-center bg-black">
	<!-- Slideshow Container with Padding and Rounded Edges -->
	<div class="wrapper relative overflow-hidden rounded-4xl">
		<SlideShow {slides} intervalTime={10000} />

		<!-- Logo Positioned at the Top -->
		<div class="absolute left-8 top-8">
			<img src="/images/takkei-logo.png" alt="Takkei Logo" class="h-16 md:h-20" />
		</div>

		<!-- Centered Login Form -->
		<div class="absolute inset-0 flex items-center justify-center">
			<LoginForm bind:email bind:password bind:errorMessage bind:rememberMe />
		</div>
	</div>
</div>

<style>
	.wrapper {
		width: calc(100% - 2rem);
		height: calc(100% - 2rem);
	}
</style>
