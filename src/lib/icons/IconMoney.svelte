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
		d="M6 12H10V28H6V12ZM20 12H14C12.9 12 12 12.9 12 14V26C12 27.1 12.9 28 14 28H20C21.1 28 22 27.1 22 26V14C22 12.9 21.1 12 20 12ZM18 24H16V16H18V24ZM32 12H26C24.9 12 24 12.9 24 14V26C24 27.1 24.9 28 26 28H32C33.1 28 34 27.1 34 26V14C34 12.9 33.1 12 32 12ZM30 24H28V16H30V24Z"
		fill="currentColor"
	/>
	<path d="M0 4V36H40V4H0ZM4 32V8H36V32H4Z" fill="currentColor" />
</svg>

<style>
	@import './_icons.scss';
</style>
