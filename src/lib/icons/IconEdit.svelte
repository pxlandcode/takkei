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
	<path
		d="M4.44444 35.5556H7.61111L29.3333 13.8333L26.1667 10.6667L4.44444 32.3889V35.5556ZM0 40V30.5556L29.3333 1.27778C29.7778 0.87037 30.2685 0.555556 30.8056 0.333333C31.3426 0.111111 31.9074 0 32.5 0C33.0926 0 33.6667 0.111111 34.2222 0.333333C34.7778 0.555556 35.2593 0.888889 35.6667 1.33333L38.7222 4.44444C39.1667 4.85185 39.4907 5.33333 39.6944 5.88889C39.8981 6.44444 40 7 40 7.55556C40 8.14815 39.8981 8.71296 39.6944 9.25C39.4907 9.78704 39.1667 10.2778 38.7222 10.7222L9.44444 40H0ZM27.7222 12.2778L26.1667 10.6667L29.3333 13.8333L27.7222 12.2778Z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
