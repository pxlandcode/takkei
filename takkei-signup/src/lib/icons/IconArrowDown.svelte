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
	<path d="M20 32.6667L0 12.6667L4.66667 8L20 23.3333L35.3333 8L40 12.6667L20 32.6667Z" />
</svg>

<style>
	@import './_icons.scss';
</style>
