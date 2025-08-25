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
		d="M20 36.3636L7.27273 29.4545V18.5454L0 14.5454L20 3.63635L40 14.5454V29.0909H36.3636V16.5454L32.7273 18.5454V29.4545L20 36.3636ZM20 21.2727L32.4545 14.5454L20 7.81817L7.54545 14.5454L20 21.2727ZM20 32.2273L29.0909 27.3182V20.4545L20 25.4545L10.9091 20.4545V27.3182L20 32.2273Z"
		fill="currentColor"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
