<script lang="ts">
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import { confirm } from '$lib/actions/confirm';
	import { createEventDispatcher } from 'svelte';
	import Button from '../../../bits/button/Button.svelte';

	type VacationEntry = {
		id?: number;
		start_date: string;
		end_date: string;
	};

	let { canEdit = false, vacations = [] } = $props<{
		canEdit?: boolean;
		vacations?: VacationEntry[];
	}>();

	const dispatch = createEventDispatcher<{ save: VacationEntry; remove: number }>();

	let newFrom = $state('');
	let newTo = $state('');
	let squareContainer: HTMLDivElement | null = null;
	let squareLimit = $state(20);

	const SQUARE_SIZE = 12;
	const GAP = 2;

	$effect(() => {
		if (!squareContainer) return;
		const width = squareContainer.offsetWidth;
		const calculated = Math.floor(width / (SQUARE_SIZE + GAP)) - 1;
		squareLimit = Math.max(1, calculated);
	});

	function addVacation() {
		if (newFrom && newTo) {
			const vacation: VacationEntry = { start_date: newFrom, end_date: newTo };
			dispatch('save', vacation);
			newFrom = '';
			newTo = '';
		}
	}

	function removeVacation(id?: number) {
		if (typeof id !== 'number') return;
		dispatch('remove', id);
	}

	function getDaysBetween(from: string, to: string): Date[] {
		const start = new Date(from);
		const end = new Date(to);
		const days: Date[] = [];

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

<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-md">
	<div class="mb-3 flex items-center gap-2">
		<div class="flex h-6 w-6 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="CalendarSun" size="14px" />
		</div>
		<h3 class="text-lg font-semibold text-text">Semester</h3>
	</div>

		{#if canEdit}
			<div class="grid grid-cols-1 gap-2 md:grid-cols-3 md:items-end">
				<Input type="date" bind:value={newFrom} label="Från" />
				<Input type="date" bind:value={newTo} label="Till" />
				<div class="mt-4 w-full md:ml-auto md:mt-8 md:w-auto">
					<Button text="Lägg till" full on:click={addVacation} />
				</div>
			</div>
		{/if}

	{#if vacations.length > 0}
		<ul class="overflow-hidden rounded-sm border border-gray-300">
				{#each vacations as v (v.start_date + v.end_date)}
					<li
						class="flex flex-col gap-3 px-4 py-3 text-sm md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:gap-4"
					>
					<!-- Left: remove + from -->
					<div class="flex items-center gap-2">
						<button
							use:confirm={{
								title: 'Ta bort semester?',
								description: `Vill du ta bort perioden ${v.start_date} till ${v.end_date}?`,
								action: () => removeVacation(v.id)
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
