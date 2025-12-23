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
	<g fill="currentColor" clip-path="url(#clip0_496_180)"
		><path
			d="M40 30.05v3.787H0V30.05zM.006 24.175h39.99v3.153H.005zM39.997 18.727v2.591H.007v-2.591zM.006 14.063h39.987v1.955H.005zM.003 11.286V9.728h39.988v1.558zM39.996 6.162v.744H.005v-.744z"
		/></g
	><defs
		><clipPath id="clip0_496_180"><path fill="currentColor" d="M0 0h40v40H0z" /></clipPath></defs
	>
</svg>

<style>
	@import './_icons.scss';
</style>
