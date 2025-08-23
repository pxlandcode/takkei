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
		d="M37.3832 33.4579L31.7757 27.8505L34.3925 25.2336L40 30.8411L37.3832 33.4579ZM30.6542 11.028L28.0374 8.41121L33.6449 2.80373L36.2617 5.42055L30.6542 11.028ZM9.34579 11.028L3.73832 5.42055L6.35514 2.80373L11.9626 8.41121L9.34579 11.028ZM2.61682 33.4579L0 30.8411L5.60748 25.2336L8.2243 27.8505L2.61682 33.4579ZM14.1121 29.9533L20 26.4019L25.8879 30L24.3458 23.271L29.5327 18.785L22.7103 18.1776L20 11.8224L17.2897 18.1308L10.4673 18.7383L15.6542 23.271L14.1121 29.9533ZM8.45794 37.757L11.4953 24.6262L1.30841 15.7944L14.7664 14.6262L20 2.24298L25.2336 14.6262L38.6916 15.7944L28.5047 24.6262L31.5421 37.757L20 30.7944L8.45794 37.757Z"
		fill="currentColor"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
