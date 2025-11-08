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
	<g clip-path="url(#clip0_413_9)">
		<path
			d="M15.4856 40L10.0684 29.9178L0 24.4932L3.88509 20.6575L11.8194 22.0274L17.4008 16.4384L0.0547196 9.0411L4.65116 4.32877L25.7182 8.05479L32.5034 1.26027C33.3425 0.420091 34.3821 0 35.6224 0C36.8627 0 37.9024 0.420091 38.7415 1.26027C39.5805 2.10046 40 3.13242 40 4.35616C40 5.57991 39.5805 6.61187 38.7415 7.45205L31.9015 14.3014L35.6224 35.3425L30.9713 40L23.5294 22.6301L17.948 28.2192L19.3707 36.1096L15.4856 40Z"
			fill="currentColor"
		/>
	</g>
	<defs>
		<clipPath id="clip0_413_9">
			<rect width="40" height="40" fill="currentColor" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
