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
		d="M4.23333e-08 12.2144L3.55 8.66443L20 25.1144L36.45 8.66443L40 12.2144L20 32.2144L4.23333e-08 12.2144Z"
		fill="currentColor"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
