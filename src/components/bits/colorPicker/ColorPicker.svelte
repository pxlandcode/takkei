<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let value = '#8B5CF6'; // Initial hex value
	export let showColor = false;
	const dispatch = createEventDispatcher();

	let hue = 260;
	let saturation = 100;
	let lightness = 50;

	function hslToHex(h, s, l) {
		s /= 100;
		l /= 100;

		const k = (n) => (n + h / 30) % 12;
		const a = s * Math.min(l, 1 - l);
		const f = (n) =>
			Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));

		return `#${f(0).toString(16).padStart(2, '0')}${f(8).toString(16).padStart(2, '0')}${f(4)
			.toString(16)
			.padStart(2, '0')}`;
	}

	function updateColor() {
		value = hslToHex(hue, saturation, lightness);
		dispatch('change', value);
	}
</script>

<div class="w-full max-w-md space-y-2">
	<label class="block text-sm text-text">Färg:</label>

	<!-- Hue Slider -->
	<div>
		<label class="text-xs">Färgton</label>
		<input
			type="range"
			min="0"
			max="360"
			bind:value={hue}
			on:input={updateColor}
			class="w-full appearance-none"
			style="background: linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)"
		/>
	</div>

	<!-- Lightness Slider -->
	<div>
		<label class="text-xs">Ljusstyrka</label>
		<input
			type="range"
			min="0"
			max="100"
			bind:value={lightness}
			on:input={updateColor}
			class="w-full appearance-none"
			style="background: linear-gradient(to right, black, white)"
		/>
	</div>

	{#if showColor}
		<div class="h-12 w-full rounded-md border" style="background-color: {value};"></div>
	{/if}
</div>

<style>
	input[type='range'] {
		height: 14px;
		border-radius: 9999px;
		outline: none;
		margin-top: 4px;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		height: 18px;
		width: 18px;
		border-radius: 9999px;
		background: white;
		border: 2px solid #aaa;
		cursor: pointer;
		box-shadow: 0 0 1px #000;
		margin-top: -2px;
	}
</style>
