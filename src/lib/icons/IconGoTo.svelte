<script>
	export let size = '40px';
	export let color = 'black';
	export let extraClasses = '';

	$: classString = `text-${color} ${extraClasses}`;
</script>

<svg
	width={size}
	height={size}
	class={classString}
	fill="currentColor"
	viewBox="0 0 40 40"
	xmlns="http://www.w3.org/2000/svg"
>
	<g clip-path="url(#clip0_219_1837)">
		<path
			d="M4.44444 40C3.22222 40 2.17593 39.5648 1.30556 38.6944C0.435185 37.8241 0 36.7778 0 35.5556V4.44444C0 3.22222 0.435185 2.17593 1.30556 1.30556C2.17593 0.435185 3.22222 0 4.44444 0H20V4.44444H4.44444V35.5556H35.5556V20H40V35.5556C40 36.7778 39.5648 37.8241 38.6944 38.6944C37.8241 39.5648 36.7778 40 35.5556 40H4.44444ZM14.8889 28.2222L11.7778 25.1111L32.4444 4.44444H24.4444V0H40V15.5556H35.5556V7.55556L14.8889 28.2222Z"
		/>
	</g>
	<defs>
		<clipPath id="clip0_219_1837">
			<rect width="40" height="40" fill="currentColor" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
