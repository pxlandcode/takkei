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
		fill="currentColor"
		d="M27.999 10h-24C1.795 10 0 11.795 0 14v20c0 2.205 1.794 4 4 4h23.999c2.206 0 4-1.795 4-4V14c0-2.206-1.794-4-4-4m-24 24V18h24v-4l.004 20z"
	/><path
		fill="currentColor"
		d="M39.998 6c0-2.205-1.794-4-4-4H10C7.793 2 6 3.796 6 6h26a4.003 4.003 0 0 1 3.998 3.989l.004 16.01h-.004v4c2.206 0 4-1.793 4-4V12.015L40 12V8l-.002-.02z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
