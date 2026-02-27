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
		d="M25.7105 17.3158C27.8684 15.9211 29.2895 13.4737 29.2895 10.7105C29.2895 6.3421 25.7632 2.81579 21.3947 2.81579C18.6316 2.81579 16.1842 4.23684 14.7895 6.39474L25.7105 17.3158ZM37.1579 28.7895C36.9737 27.1579 36.0789 25.6842 34.6579 24.8421C33.7368 24.2895 32.7632 23.8158 31.7632 23.3684L37.1579 28.7895ZM2.78947 0L0 2.78947L18.6053 21.3947C14.8158 21.7895 11.2895 23.0263 8.15789 24.8421C6.55263 25.7632 5.60526 27.5263 5.60526 29.3684V34.3947H31.6053L37.2105 40L40 37.2105L2.78947 0Z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
