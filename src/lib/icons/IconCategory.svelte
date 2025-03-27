<script>
	export let size = '40px';
	export let color = 'black';
	export let extraClasses = '';

	$: classString = `text-${color} ${extraClasses}`;
</script>

<svg
	width={size}
	height={size}
	class={classString}
	fill="currentColor"
	viewBox="0 0 40 40"
	xmlns="http://www.w3.org/2000/svg"
>
	<path
		d="M8 18L19 0L30 18H8ZM30 40C27.5 40 25.375 39.125 23.625 37.375C21.875 35.625 21 33.5 21 31C21 28.5 21.875 26.375 23.625 24.625C25.375 22.875 27.5 22 30 22C32.5 22 34.625 22.875 36.375 24.625C38.125 26.375 39 28.5 39 31C39 33.5 38.125 35.625 36.375 37.375C34.625 39.125 32.5 40 30 40ZM1 39V23H17V39H1ZM30 36C31.4 36 32.5833 35.5167 33.55 34.55C34.5167 33.5833 35 32.4 35 31C35 29.6 34.5167 28.4167 33.55 27.45C32.5833 26.4833 31.4 26 30 26C28.6 26 27.4167 26.4833 26.45 27.45C25.4833 28.4167 25 29.6 25 31C25 32.4 25.4833 33.5833 26.45 34.55C27.4167 35.5167 28.6 36 30 36ZM5 35H13V27H5V35ZM15.1 14H22.9L19 7.7L15.1 14Z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
