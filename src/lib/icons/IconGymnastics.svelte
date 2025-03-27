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
	<path
		d="M20.681 33.3636L19.7719 15.1818L13.4083 13.3636H0.68103V9.72726H11.5901L24.3174 0.636353L26.681 3.40908L19.1356 8.81817H24.3174L38.4992 0.636353L40.681 3.18181L25.2265 15.1818L24.3174 33.3636H20.681ZM9.77194 7.90908C8.77194 7.90908 7.91588 7.55302 7.20376 6.8409C6.49164 6.12878 6.13558 5.27272 6.13558 4.27272C6.13558 3.27272 6.49164 2.41666 7.20376 1.70453C7.91588 0.992413 8.77194 0.636353 9.77194 0.636353C10.7719 0.636353 11.628 0.992413 12.3401 1.70453C13.0522 2.41666 13.4083 3.27272 13.4083 4.27272C13.4083 5.27272 13.0522 6.12878 12.3401 6.8409C11.628 7.55302 10.7719 7.90908 9.77194 7.90908Z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
