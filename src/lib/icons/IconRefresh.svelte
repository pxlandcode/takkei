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
	<g clip-path="url(#clip0_383_200)">
		<path
			d="M20.869 40C15.2857 40 10.5565 38.0625 6.68152 34.1875C2.80652 30.3125 0.869019 25.5833 0.869019 20C0.869019 14.4167 2.80652 9.6875 6.68152 5.8125C10.5565 1.9375 15.2857 0 20.869 0C23.744 0 26.494 0.59375 29.119 1.78125C31.744 2.96875 33.994 4.66667 35.869 6.875V0H40.869V17.5H23.369V12.5H33.869C32.5357 10.1667 30.7128 8.33333 28.4003 7C26.0878 5.66667 23.5774 5 20.869 5C16.7024 5 13.1607 6.45833 10.244 9.375C7.32735 12.2917 5.86902 15.8333 5.86902 20C5.86902 24.1667 7.32735 27.7083 10.244 30.625C13.1607 33.5417 16.7024 35 20.869 35C24.0774 35 26.9732 34.0833 29.5565 32.25C32.1399 30.4167 33.9524 28 34.994 25H40.244C39.0774 29.4167 36.7024 33.0208 33.119 35.8125C29.5357 38.6042 25.4524 40 20.869 40Z"
			fill="black"
		/>
	</g>
	<defs>
		<clipPath id="clip0_383_200">
			<rect width="40" height="40" fill="currentColor" transform="translate(0.869019)" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
