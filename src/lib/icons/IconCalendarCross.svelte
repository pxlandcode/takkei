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
	<g clip-path="url(#clip0_473_197)"
		><path
			fill="currentColor"
			d="M6 40q-1.65 0-2.825-1.175T2 36V8q0-1.65 1.175-2.825T6 4h2V0h4v4h16V0h4v4h2q1.65 0 2.825 1.175T38 8v28q0 1.65-1.175 2.825T34 40zm0-4h28V16H6zm0-24h28V8H6z"
		/><path
			fill="currentColor"
			d="m20 27.812-5.228 5.228-1.742-1.743 5.228-5.227-5.228-5.228 1.742-1.742L20 24.327l5.228-5.228 1.742 1.743-5.227 5.228 5.227 5.227-1.742 1.743z"
		/><path
			stroke="currentColor"
			d="M6 40q-1.65 0-2.825-1.175T2 36V8q0-1.65 1.175-2.825T6 4h2V0h4v4h16V0h4v4h2q1.65 0 2.825 1.175T38 8v28q0 1.65-1.175 2.825T34 40zm0-4h28V16H6zm0-24h28V8H6z"
		/><path
			stroke="currentColor"
			d="m20 27.812-5.228 5.228-1.742-1.743 5.228-5.227-5.228-5.228 1.742-1.742L20 24.327l5.228-5.228 1.742 1.743-5.227 5.228 5.227 5.227-1.742 1.743z"
		/></g
	><defs><clipPath id="clip0_473_197"><path d="M0 0h40v40H0z" /></clipPath></defs>
</svg>

<style>
	@import './_icons.scss';
</style>
