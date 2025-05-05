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
	<g clip-path="url(#clip0_319_202)">
		<path
			d="M0.319336 36.8421V3.1579L40.3193 20L0.319336 36.8421ZM4.52986 30.5263L29.4772 20L4.52986 9.47369V16.8421L17.1614 20L4.52986 23.1579V30.5263Z"
		/>
	</g>
	<defs>
		<clipPath id="clip0_319_202">
			<rect width="40" height="40" transform="translate(0.319336)" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
