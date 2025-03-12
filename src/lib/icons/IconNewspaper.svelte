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
		d="M4 38C2.9 38 1.95833 37.6083 1.175 36.825C0.391667 36.0417 0 35.1 0 34V6C0 4.9 0.391667 3.95833 1.175 3.175C1.95833 2.39167 2.9 2 4 2H36C37.1 2 38.0417 2.39167 38.825 3.175C39.6083 3.95833 40 4.9 40 6V34C40 35.1 39.6083 36.0417 38.825 36.825C38.0417 37.6083 37.1 38 36 38H4ZM4 34H36V6H4V34ZM8 30H32V26H8V30ZM8 22H16V10H8V22ZM20 22H32V18H20V22ZM20 14H32V10H20V14Z"
	/>
</svg>

<style>
	@import './_icons.scss';
</style>
