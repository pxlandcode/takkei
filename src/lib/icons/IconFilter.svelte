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
		d="M18.2678 40V26.6667H22.7122V31.1111H40.49V35.5556H22.7122V40H18.2678ZM0.48999 35.5556V31.1111H13.8233V35.5556H0.48999ZM9.37888 26.6667V22.2222H0.48999V17.7778H9.37888V13.3333H13.8233V26.6667H9.37888ZM18.2678 22.2222V17.7778H40.49V22.2222H18.2678ZM27.1567 13.3333V0H31.6011V4.44444H40.49V8.88889H31.6011V13.3333H27.1567ZM0.48999 8.88889V4.44444H22.7122V8.88889H0.48999Z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
