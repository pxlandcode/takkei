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
		d="M8.8889 40C7.66667 40 6.62038 39.5648 5.75001 38.6944C4.87964 37.8241 4.44445 36.7778 4.44445 35.5556V6.66667H2.22223V2.22222H13.3333V0H26.6667V2.22222H37.7778V6.66667H35.5556V35.5556C35.5556 36.7778 35.1204 37.8241 34.25 38.6944C33.3796 39.5648 32.3333 40 31.1111 40H8.8889ZM31.1111 6.66667H8.8889V35.5556H31.1111V6.66667ZM13.3333 31.1111H17.7778V11.1111H13.3333V31.1111ZM22.2222 31.1111H26.6667V11.1111H22.2222V31.1111Z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
