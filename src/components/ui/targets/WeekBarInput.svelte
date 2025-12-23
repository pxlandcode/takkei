<script lang="ts">
	import Icon from '../../bits/icon-component/Icon.svelte';

	interface Props {
		weekStart?: string;
		weekEnd?: string;
		value?: number;
		cap?: number;
		scaleMax?: number;
		locked?: boolean;
		disabled?: boolean;
		oninput?: (detail: { weekStart: string; value: number }) => void;
		oncommit?: (detail: { weekStart: string; value: number }) => void;
		ontoggle?: (detail: { weekStart: string }) => void;
	}

	let {
		weekStart = '',
		weekEnd = '',
		value = 0,
		cap = 0,
		scaleMax = 0,
		locked = false,
		disabled = false,
		oninput,
		oncommit,
		ontoggle
	}: Props = $props();

	let refreshing = $state(false);

	const clamp = (n: number) => Math.min(cap, Math.max(0, Math.round(n)));

	let draft = $state(String(value));

	$effect(() => {
		draft = String(value);
	});

	// Format week range for display
	function formatWeekRange(start: string, end: string): string {
		const s = new Date(start);
		const e = new Date(end);
		const sDay = s.getDate();
		const eDay = e.getDate();
		const sMonth = s.toLocaleDateString('sv-SE', { month: 'short' });
		const eMonth = e.toLocaleDateString('sv-SE', { month: 'short' });

		if (sMonth === eMonth) {
			return `${sDay}–${eDay} ${sMonth}`;
		}
		return `${sDay} ${sMonth} – ${eDay} ${eMonth}`;
	}

	function handleType(e: Event) {
		const raw = Number((e.currentTarget as HTMLInputElement).value);
		if (!Number.isFinite(raw)) return;
		oninput?.({ weekStart, value: clamp(raw) });
	}
	function handleCommit() {
		const raw = Number(draft);
		const v = Number.isFinite(raw) ? clamp(raw) : 0;
		draft = String(v);
		oncommit?.({ weekStart, value: v });
	}
	function handleToggle() {
		ontoggle?.({ weekStart });
	}

	function handleRefreshClick() {
		if (disabled) return;
		refreshing = true;
		handleToggle();
		setTimeout(() => (refreshing = false), 600);
	}

	const MAX_BAR_PCT = 96;
	const MIN_VISIBLE_PCT = 3;

	let denom = $derived(Math.max(1, scaleMax));
	let rawPct = $derived((value / denom) * 100);
	let pctFill = $derived(
		value === 0 ? 0 : Math.max(MIN_VISIBLE_PCT, Math.min(MAX_BAR_PCT, rawPct * (MAX_BAR_PCT / 100)))
	);
</script>

<div class="grid grid-cols-[140px_1fr_120px_78px] items-center gap-3 pl-4">
	<!-- Label -->
	<div class="text-xs font-medium text-gray-600">{formatWeekRange(weekStart, weekEnd)}</div>

	<!-- Bar -->
	<div class="relative h-[6px] overflow-hidden rounded-full bg-black/10 select-none">
		<div
			class="bg-orange/80 pointer-events-none absolute inset-y-0 left-0 rounded-full"
			style={`width:${pctFill}%`}
		/>
	</div>

	<!-- Numeric input + +/- -->
	<div class="flex items-center gap-2">
		<input
			type="number"
			inputmode="numeric"
			class="focus:ring-orange w-full rounded-sm border px-2 py-1 text-xs focus:ring-2 focus:outline-hidden disabled:opacity-60"
			bind:value={draft}
			{disabled}
			min="0"
			max={cap}
			oninput={handleType}
			onblur={handleCommit}
			onkeydown={(e) => (e.key === 'Enter' ? handleCommit() : null)}
			aria-label={`Mål för vecka ${weekStart}`}
		/>
		<button
			type="button"
			class="rounded-sm border px-1.5 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-40"
			disabled={disabled || value <= 0}
			onclick={() => {
				const v = Math.max(0, value - 1);
				oninput?.({ weekStart, value: v });
				oncommit?.({ weekStart, value: v });
			}}
			title="-1">–</button
		>
		<button
			type="button"
			class="rounded-sm border px-1.5 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-40"
			disabled={disabled || value >= cap}
			onclick={() => {
				const v = Math.min(cap, value + 1);
				oninput?.({ weekStart, value: v });
				oncommit?.({ weekStart, value: v });
			}}
			title="+1">+</button
		>
	</div>

	<!-- Status + lock toggle -->
	<div class="flex items-center justify-end gap-2">
		{#if locked}
			<span class="rounded-sm px-2 py-1"><Icon icon="Lock" size="12" color="error" /></span>
		{:else}
			<span class="rounded-sm px-2 py-1"><Icon icon="Unlocked" size="12" color="success" /></span>
		{/if}
		<button
			type="button"
			class="rounded-sm border px-1.5 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-60"
			onclick={handleRefreshClick}
			{disabled}
			title={locked ? 'Lås upp' : 'Lås'}
			aria-label="Uppdatera"
		>
			<span class="inline-block" class:half-spin={refreshing}>
				<Icon icon="Refresh" size="12" />
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
			transform: rotate(360deg);
		}
	}
</style>
