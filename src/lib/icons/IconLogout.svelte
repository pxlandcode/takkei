<script>
	export let size = '40px';
	export let color = 'black';
	export let extraClasses = '';
	export let extraStyle = '';

	$: classString = `text-${color} ${extraClasses}`;
	$: styleString = `${extraStyle}`;
</script>

<svg
	width={size}
	height={size}
	class={classString}
	style={styleString}
	fill="currentColor"
	viewBox="0 0 40 40"
	xmlns="http://www.w3.org/2000/svg"
>
	<g clip-path="url(#clip0_323_218)">
		<path
			d="M4.57543 40C3.3532 40 2.30691 39.5648 1.43654 38.6944C0.566167 37.8241 0.130981 36.7778 0.130981 35.5556V4.44444C0.130981 3.22222 0.566167 2.17593 1.43654 1.30556C2.30691 0.435185 3.3532 0 4.57543 0H20.131V4.44444H4.57543V35.5556H20.131V40H4.57543ZM29.0199 31.1111L25.9643 27.8889L31.631 22.2222H13.4643V17.7778H31.631L25.9643 12.1111L29.0199 8.88889L40.131 20L29.0199 31.1111Z"
		/>
	</g>
	<defs>
		<clipPath id="clip0_323_218">
			<rect width="40" height="40" transform="translate(0.130981)" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
