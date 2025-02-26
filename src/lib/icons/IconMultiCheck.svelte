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
	<g clip-path="url(#clip0_194_197)">
		<path
			d="M10.6386 30.9817L0.31897 20.6621L2.92171 18.105L10.6843 25.8676L13.2413 28.4246L10.6386 30.9817ZM20.9582 30.9817L10.6386 20.6621L13.1957 18.0593L20.9582 25.8219L37.7619 9.01825L40.319 11.621L20.9582 30.9817ZM20.9582 20.6621L18.3555 18.105L27.3966 9.06391L29.9993 11.621L20.9582 20.6621Z"
			fill="currentColor"
		/>
	</g>
	<defs>
		<clipPath id="clip0_194_197">
			<rect width="40" height="40" fill="currentColor" transform="translate(0.31897)" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
