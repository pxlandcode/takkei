<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';

	export let name = '';
	export let month = 1;
	export let value = 0;
	export let cap = 0;
	export let scaleMax = 0; // shared max from parent (across all months)
	export let locked = false;
	export let disabled = false;

	let refreshing = false;

	const dispatch = createEventDispatcher<{
		input: { month: number; value: number };
		commit: { month: number; value: number };
		toggle: { month: number };
	}>();

	const clamp = (n: number) => Math.min(cap, Math.max(0, Math.round(n)));

	let draft = String(value);
	$: draft = String(value);

	function handleType(e: Event) {
		const raw = Number((e.currentTarget as HTMLInputElement).value);
		if (!Number.isFinite(raw)) return;
		dispatch('input', { month, value: clamp(raw) });
	}
	function handleCommit() {
		const raw = Number(draft);
		const v = Number.isFinite(raw) ? clamp(raw) : 0;
		draft = String(v);
		dispatch('commit', { month, value: v });
	}
	function handleToggle() {
		dispatch('toggle', { month });
	}

	function handleRefreshClick() {
		if (disabled) return;
		refreshing = true;
		handleToggle(); // your existing logic
		setTimeout(() => (refreshing = false), 600); // match animation duration
	}

	// --- BAR VISUALS (uniform track; scaled fill) -----------------------------
	const MAX_BAR_PCT = 96; // max orange fill when value == global max
	const MIN_VISIBLE_PCT = 3; // tiny visible sliver for non-zero values

	$: denom = Math.max(1, scaleMax); // global max from parent
	$: rawPct = (value / denom) * 100; // 0..100 (relative to global max)
	$: pctFill =
		value === 0
			? 0
			: Math.max(MIN_VISIBLE_PCT, Math.min(MAX_BAR_PCT, rawPct * (MAX_BAR_PCT / 100)));
</script>

<div class="grid grid-cols-[140px,1fr,120px,78px] items-center gap-3">
	<!-- Label -->
	<div class="text-sm font-medium capitalize">{name}</div>

	<!-- Bar: full-width gray track, orange fill scaled to global max -->
	<div class="relative h-[8px] select-none overflow-hidden rounded-full bg-black/15">
		<div
			class="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-orange"
			style={`width:${pctFill}%`}
		/>
	</div>

	<!-- Numeric input + +/- -->
	<div class="flex items-center gap-2">
		<input
			type="number"
			inputmode="numeric"
			class="w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange disabled:opacity-60"
			bind:value={draft}
			{disabled}
			min="0"
			max={cap}
			on:input={handleType}
			on:blur={handleCommit}
			on:keydown={(e) => ((e as KeyboardEvent).key === 'Enter' ? handleCommit() : null)}
			aria-label={`Mål för ${name}`}
		/>
		<button
			type="button"
			class="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
			disabled={disabled || value <= 0}
			on:click={() => {
				const v = Math.max(0, value - 1);
				dispatch('input', { month, value: v });
				dispatch('commit', { month, value: v });
			}}
			title="-1">–</button
		>
		<button
			type="button"
			class="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
			disabled={disabled || value >= cap}
			on:click={() => {
				const v = Math.min(cap, value + 1);
				dispatch('input', { month, value: v });
				dispatch('commit', { month, value: v });
			}}
			title="+1">+</button
		>
	</div>

	<!-- Status + lock toggle -->
	<div class="flex items-center justify-end gap-2">
		{#if locked}
			<span class="xt-green-700 text-x rounded px-2 py-1"
				><Icon icon="Lock" size="14" color="error" /></span
			>
		{:else}
			<span class="rounded px-2 py-1 text-xs"
				><Icon icon="Unlocked" size="14" color="success" /></span
			>
		{/if}
		<button
			type="button"
			class="rounded border px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-60"
			on:click={handleRefreshClick}
			{disabled}
			title={locked ? 'Lås upp' : 'Lås'}
			aria-label="Uppdatera"
		>
			<span class="inline-block" class:half-spin={refreshing}>
				<Icon icon="Refresh" size="14" />
			</span>
		</button>
	</div>
</div>

<style>
	.half-spin {
		display: inline-block;
		transform-origin: center;
		animation: halfSpin 0.3s ease-in-out;
	}
	@keyframes halfSpin {
		0% {
			transform: rotate(0deg);
		}
		50% {
			transform: rotate(180deg);
		}
		100% {
			transform: rotate(0deg);
		}
	}
</style>
