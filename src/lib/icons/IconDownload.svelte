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
	<g clip-path="url(#clip0_383_205)">
		<path
			d="M20 30L7.5 17.5L11 13.875L17.5 20.375V0H22.5V20.375L29 13.875L32.5 17.5L20 30ZM5 40C3.625 40 2.44792 39.5104 1.46875 38.5312C0.489583 37.5521 0 36.375 0 35V27.5H5V35H35V27.5H40V35C40 36.375 39.5104 37.5521 38.5312 38.5312C37.5521 39.5104 36.375 40 35 40H5Z"
		/>
	</g>
	<defs>
		<clipPath id="clip0_383_205">
			<rect width="40" height="40" fill="currentColor" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
