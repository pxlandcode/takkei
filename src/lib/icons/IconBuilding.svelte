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
	<g clip-path="url(#clip0_24_108)">
		<path
			d="M0.171021 40V8.88889H9.05991V0H31.2821V17.7778H40.171V40H22.3932V31.1111H17.9488V40H0.171021ZM4.61546 35.5556H9.05991V31.1111H4.61546V35.5556ZM4.61546 26.6667H9.05991V22.2222H4.61546V26.6667ZM4.61546 17.7778H9.05991V13.3333H4.61546V17.7778ZM13.5044 26.6667H17.9488V22.2222H13.5044V26.6667ZM13.5044 17.7778H17.9488V13.3333H13.5044V17.7778ZM13.5044 8.88889H17.9488V4.44444H13.5044V8.88889ZM22.3932 26.6667H26.8377V22.2222H22.3932V26.6667ZM22.3932 17.7778H26.8377V13.3333H22.3932V17.7778ZM22.3932 8.88889H26.8377V4.44444H22.3932V8.88889ZM31.2821 35.5556H35.7266V31.1111H31.2821V35.5556ZM31.2821 26.6667H35.7266V22.2222H31.2821V26.6667Z"
			fill="currentColor"
		/>
	</g>
	<defs>
		<clipPath id="clip0_24_108">
			<rect width="40" height="40" fill="currentColor" transform="translate(0.171021)" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
