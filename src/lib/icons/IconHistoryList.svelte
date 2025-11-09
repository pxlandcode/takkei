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
		fill="currentcolor"
		fill-rule="evenodd"
		d="M23.572 29.58c-1.166.3-2.39.46-3.65.46a14.56 14.56 0 0 1-10.326-4.278l2.582-2.581a10.92 10.92 0 0 0 7.744 3.208c1.28 0 2.508-.22 3.65-.624zM5.32 15.436q0 .56.042 1.11l-2.78-2.779L0 16.349l7.145 7.145 7.144-7.145-2.581-2.581-2.691 2.69a11 11 0 0 1-.047-1.021c0-6.049 4.903-10.952 10.952-10.952 6.048 0 10.952 4.903 10.952 10.952 0 2.805-1.055 5.363-2.79 7.301h4.487a14.54 14.54 0 0 0 1.953-7.301c0-8.065-6.538-14.603-14.602-14.603S5.319 7.372 5.319 15.437m12.777.986V6.31h3.651v8.141l4.654 3.121-2.007 3.03zM40 24.563v3.65h-9.126v-3.65zm-10.952 0v3.65h-3.65v-3.65zM40 33.69v-3.65h-9.126v3.65zm-10.952-3.65v3.65h-3.65v-3.65zM40 39.165v-3.651h-9.126v3.65zm-10.952-3.651v3.65h-3.65v-3.65z"
		clip-rule="evenodd"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
