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
	<g clip-path="url(#clip0_24_36)">
		<path
			d="M28.225 0.439453L31.775 3.98945L15.325 20.4395L31.775 36.8895L28.225 40.4395L8.22503 20.4395L28.225 0.439453Z"
			fill="currentColor"
		/>
	</g>
	<defs>
		<clipPath id="clip0_24_36">
			<rect width="40" height="40" fill="white" transform="translate(40 40.4395) rotate(-180)" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
