<script>
	export let size = '40px';
	export let color = null;
	export let extraClasses = '';
	export let extraStyle = '';

	$: classString = `${extraClasses} ${color ? `text-${color}` : ''}`;
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
		d="M23.0283 40.2L20.2 37.3717L27.3717 30.2L10.2 13.0283L3.02829 20.2L0.200012 17.3717L3.02829 14.4424L0.200012 11.6142L4.44244 7.37173L1.61415 4.44244L4.44244 1.61415L7.37173 4.44244L11.6142 0.200012L14.4424 3.02829L17.3717 0.200012L20.2 3.02829L13.0283 10.2L30.2 27.3717L37.3717 20.2L40.2 23.0283L37.3717 25.9576L40.2 28.7859L35.9576 33.0283L38.7859 35.9576L35.9576 38.7859L33.0283 35.9576L28.7859 40.2L25.9576 37.3717L23.0283 40.2Z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
