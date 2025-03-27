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
	<g clip-path="url(#clip0_219_1845)">
		<path
			d="M0.469971 33.3334V28.8889H40.47V33.3334H0.469971ZM0.469971 22.2222V17.7778H40.47V22.2222H0.469971ZM0.469971 11.1111V6.66669H40.47V11.1111H0.469971Z"
		/>
	</g>
	<defs>
		<clipPath id="clip0_219_1845">
			<rect width="40" height="40" fill="currentColor" transform="translate(0.469971)" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
