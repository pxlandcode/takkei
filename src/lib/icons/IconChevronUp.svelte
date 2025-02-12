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
	<g clip-path="url(#clip0_24_36)">
		<path
			d="M40 28.6645L36.45 32.2145L20 15.7645L3.55 32.2145L4.23333e-08 28.6645L20 8.66448L40 28.6645Z"
			fill="currentColor"
		/>
	</g>
	<defs>
		<clipPath id="clip0_24_36">
			<rect width="40" height="40" fill="white" transform="translate(0 40.4395) rotate(-90)" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
