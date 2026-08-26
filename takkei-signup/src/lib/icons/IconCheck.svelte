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
		d="M14.478 30.1938L0.490234 16.206L3.98717 12.7091L14.478 23.1999L36.9933 0.68457L40.4902 4.1815L14.478 30.1938Z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
