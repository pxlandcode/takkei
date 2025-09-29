<script lang="ts">
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import { confirm } from '$lib/actions/confirm';
	import { createEventDispatcher, onMount } from 'svelte';
	import Button from '../../../bits/button/Button.svelte';

	export let canEdit: () => boolean;
	export let vacations = [];

	const dispatch = createEventDispatcher();

	let newFrom = '';
	let newTo = '';
	let squareContainer;
	let squareLimit = 20;

	const SQUARE_SIZE = 12;
	const GAP = 2;

	$: if (squareContainer) {
		const width = squareContainer.offsetWidth;
		squareLimit = Math.floor(width / (SQUARE_SIZE + GAP)) - 1;
	}

	function addVacation() {
		if (newFrom && newTo) {
			const vacation = { start_date: newFrom, end_date: newTo };
			vacations = [...vacations, vacation];
			dispatch('save', vacation);
			newFrom = '';
			newTo = '';
		}
	}

	function removeVacation(vacationToRemove) {
		vacations = vacations.filter((v) => v !== vacationToRemove);
		dispatch('remove', vacationToRemove);
	}

	function getDaysBetween(from: string, to: string): Date[] {
		const start = new Date(from);
		const end = new Date(to);
		const days = [];

		while (start <= end) {
			days.push(new Date(start));
			start.setDate(start.getDate() + 1);
		}

		return days;
	}

	function formatDate(date: string): string {
		return new Date(date).toISOString().slice(0, 10);
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-md">
	<div class="mb-3 flex items-center gap-2">
		<div class="flex h-6 w-6 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="CalendarSun" size="14px" />
		</div>
		<h3 class="text-lg font-semibold text-text">Semester</h3>
	</div>

	{#if canEdit()}
		<div class="grid grid-cols-1 gap-2 md:grid-cols-3">
			<Input type="date" bind:value={newFrom} label="Från" />
			<Input type="date" bind:value={newTo} label="Till" />
			<div class="ml-auto mt-8">
				<Button text="Lägg till" on:click={addVacation} />
			</div>
		</div>
	{/if}

	{#if vacations.length > 0}
		<ul class="overflow-hidden rounded-sm border border-gray-300">
			{#each vacations as v (v.start_date + v.end_date)}
				<li class="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 text-sm">
					<!-- Left: remove + from -->
					<div class="flex items-center gap-2">
						<button
							use:confirm={{
								title: 'Ta bort semester?',
								description: `Vill du ta bort perioden ${v.start_date} till ${v.end_date}?`,
								action: () => removeVacation(v)
							}}
							class="cursor-pointer text-red-600 transition hover:scale-110"
						>
							<Icon icon="CircleCross" size="18" />
						</button>
						<span class="text-xs text-gray-700">{formatDate(v.start_date)}</span>
					</div>

					<!-- Middle: squares -->
					<div class="flex flex-wrap gap-[2px]" bind:this={squareContainer}>
						{#each getDaysBetween(v.start_date, v.end_date).slice(0, squareLimit - 1) as d (d.toDateString())}
							<div class="h-[12px] w-[12px] rounded-xs bg-orange"></div>
						{/each}

						{#if getDaysBetween(v.start_date, v.end_date).length > squareLimit}
							<div
								class="flex h-[12px] w-[12px] items-center justify-center text-[10px] font-bold text-black"
							>
								+
							</div>
						{:else}
							{#each Array(squareLimit - getDaysBetween(v.start_date, v.end_date).length).fill(0) as _}
								<div class="h-[12px] w-[12px] rounded-xs bg-gray-200"></div>
							{/each}
						{/if}
					</div>

					<!-- Right: to -->
					<div class="text-xs text-gray-700">{formatDate(v.end_date)}</div>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm italic text-gray-400">Ingen semester registrerad.</p>
	{/if}
</div>

<style>
	.input {
		@apply w-full rounded border px-2 py-1 text-sm;
	}
</style>
