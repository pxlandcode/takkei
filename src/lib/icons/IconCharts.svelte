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
	<g clip-path="url(#clip0_199_204)">
		<path
			d="M9.35929 31.1111H13.8037V20H9.35929V31.1111ZM27.1371 31.1111H31.5815V8.88889H27.1371V31.1111ZM18.2482 31.1111H22.6926V24.4444H18.2482V31.1111ZM18.2482 20H22.6926V15.5556H18.2482V20ZM4.91484 40C3.69262 40 2.64632 39.5648 1.77595 38.6944C0.905583 37.8241 0.470398 36.7778 0.470398 35.5556V4.44444C0.470398 3.22222 0.905583 2.17593 1.77595 1.30556C2.64632 0.435185 3.69262 0 4.91484 0H36.026C37.2482 0 38.2945 0.435185 39.1648 1.30556C40.0352 2.17593 40.4704 3.22222 40.4704 4.44444V35.5556C40.4704 36.7778 40.0352 37.8241 39.1648 38.6944C38.2945 39.5648 37.2482 40 36.026 40H4.91484ZM4.91484 35.5556H36.026V4.44444H4.91484V35.5556Z"
		/>
	</g>
	<defs>
		<clipPath id="clip0_199_204">
			<rect width="40" height="40" transform="translate(0.470398)" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
