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
		d="M0 33.3334V28.8889H13.3333V33.3334H0ZM0 22.2222V17.7778H26.6667V22.2222H0ZM0 11.1111V6.66669H40V11.1111H0Z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
