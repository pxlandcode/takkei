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
	<g clip-path="url(#clip0_448_197)">
		<path
			d="M10 36L0 26L10 16L12.8 18.85L7.65 24H22V28H7.65L12.8 33.15L10 36ZM30 24L27.2 21.15L32.35 16H18V12H32.35L27.2 6.85L30 4L40 14L30 24Z"
			fill="currentColor"
		/>
	</g>
	<defs>
		<clipPath id="clip0_448_197">
			<rect width="40" height="40" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
