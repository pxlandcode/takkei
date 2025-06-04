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
		d="M17.92 32.7L10.82 25.6L13.72 22.7L17.92 26.9L26.32 18.5L29.22 21.4L17.92 32.7ZM6.02002 40C4.92002 40 3.97835 39.6083 3.19502 38.825C2.41169 38.0417 2.02002 37.1 2.02002 36V8C2.02002 6.9 2.41169 5.95833 3.19502 5.175C3.97835 4.39167 4.92002 4 6.02002 4H8.02002V0H12.02V4H28.02V0H32.02V4H34.02C35.12 4 36.0617 4.39167 36.845 5.175C37.6284 5.95833 38.02 6.9 38.02 8V36C38.02 37.1 37.6284 38.0417 36.845 38.825C36.0617 39.6083 35.12 40 34.02 40H6.02002ZM6.02002 36H34.02V16H6.02002V36ZM6.02002 12H34.02V8H6.02002V12Z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
