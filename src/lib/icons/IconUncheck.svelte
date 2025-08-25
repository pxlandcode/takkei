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
		d="M37.4718 37.8781L25.553 25.9594L20.4063 31.1061L10.2032 20.9029L12.7314 18.2844L20.4063 25.9594L22.9345 23.4311L4.24379 4.7404L6.77201 2.12189L40 35.3499L37.4718 37.8781ZM10.2032 31.1061L0 20.9029L2.52822 18.3747L10.2032 26.0497L12.7314 28.5779L10.2032 31.1061ZM30.6095 20.9029L28.0813 18.3747L36.93 9.52595L39.5485 11.9639L30.6095 20.9029ZM25.4628 15.7562L22.9345 13.228L26.8172 9.34536L29.3454 11.8736L25.4628 15.7562Z"
		fill="currentColor"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
