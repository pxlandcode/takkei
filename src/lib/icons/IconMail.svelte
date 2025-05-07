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
	<g clip-path="url(#clip0_319_200)">
		<path
			d="M4.8291 36.8035C3.7291 36.8035 2.78743 36.4118 2.0041 35.6285C1.22077 34.8451 0.829102 33.9035 0.829102 32.8035V8.80347C0.829102 7.70347 1.22077 6.7618 2.0041 5.97847C2.78743 5.19513 3.7291 4.80347 4.8291 4.80347H36.8291C37.9291 4.80347 38.8708 5.19513 39.6541 5.97847C40.4374 6.7618 40.8291 7.70347 40.8291 8.80347V32.8035C40.8291 33.9035 40.4374 34.8451 39.6541 35.6285C38.8708 36.4118 37.9291 36.8035 36.8291 36.8035H4.8291ZM20.8291 22.8035L4.8291 12.8035V32.8035H36.8291V12.8035L20.8291 22.8035ZM20.8291 18.8035L36.8291 8.80347H4.8291L20.8291 18.8035ZM4.8291 12.8035V8.80347V32.8035V12.8035Z"
		/>
	</g>
	<defs>
		<clipPath id="clip0_319_200">
			<rect width="40" height="40" transform="translate(0.829102 0.803467)" />
		</clipPath>
	</defs>
</svg>

<style>
	@import './_icons.scss';
</style>
