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
	<path
		d="M17.1429 22.8571H0V17.1429H17.1429V0H22.8571V17.1429H40V22.8571H22.8571V40H17.1429V22.8571Z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
