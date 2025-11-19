<script lang="ts">
	import Button from '../../../bits/button/Button.svelte';
	import { createEventDispatcher } from 'svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import { confirm } from '$lib/actions/confirm';
	import Icon from '../../../bits/icon-component/Icon.svelte';

	type DateEntry = {
		id?: number;
		date: string;
		start_time: string;
		end_time: string;
	};

	let { canEdit = false, dateAvailabilities = [] } = $props<{
		canEdit?: boolean;
		dateAvailabilities?: DateEntry[];
	}>();

	let newDate = $state('');
	let newStart = $state('');
	let newEnd = $state('');

	const dispatch = createEventDispatcher<{ save: DateEntry; remove: number }>();

	function addDateAvailability() {
		if (newDate && newStart && newEnd) {
			const newEntry: DateEntry = { date: newDate, start_time: newStart, end_time: newEnd };
			dispatch('save', newEntry);
			newDate = '';
			newStart = '';
			newEnd = '';
		}
	}

	function removeDateAvailability(id?: number) {
		if (typeof id !== 'number') return;
		dispatch('remove', id);
	}

	function formatDate(date: string): string {
		const d = new Date(date);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function formatTime(time: string): string {
		return time?.slice(0, 5) ?? '';
	}
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-md">
	<div class="mb-3 flex items-center gap-2">
		<div class="flex h-6 w-6 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Day" size="14px" />
		</div>
		<h3 class="text-lg font-semibold text-text">Datumtillgänglighet</h3>
	</div>

	{#if canEdit}
		<div class="grid w-full grid-cols-1 gap-2 md:grid-cols-4 md:items-end">
			<Input type="date" bind:value={newDate} label="Datum" />
			<Input type="time" step="900" bind:value={newStart} label="Från" />
			<Input type="time" step="900" bind:value={newEnd} label="Till" />
			<div class="mt-4 w-full md:ml-auto md:mt-8 md:w-auto">
				<Button text="Lägg till" full on:click={addDateAvailability} />
			</div>
		</div>
	{/if}

	{#if dateAvailabilities.length > 0}
		<div class=" ml-[306px] hidden justify-between text-xs text-gray-500 lg:flex">
			{#each [5, 8, 11, 14, 17, 20] as h}
				<span>{h}</span>
			{/each}
		</div>
			<ul class="overflow-hidden">
				{#each dateAvailabilities as item (item.date)}
					<li
						class="flex flex-col gap-3 border-b border-gray-100 py-3 text-sm transition md:grid md:grid-cols-[290px_auto] md:items-center md:gap-4 md:border-none"
					>
						<div class="flex flex-wrap items-center gap-2 text-sm">
							<button
								use:confirm={{
									title: 'Ta bort?',
								description: `Vill du ta bort tillgängligheten för ${formatDate(item.date)}?`,
								action: () => removeDateAvailability(item.id)
							}}
							class="cursor-pointer text-red-600 transition hover:scale-110"
						>
							<Icon icon="CircleCross" size="18" />
						</button>
						<span
							class="inline-block rounded-full bg-blue px-2 py-1 text-xs font-medium text-white"
						>
							{formatDate(item.date)}
						</span>
						<span class="text-gray-700"
							>{formatTime(item.start_time)} – {formatTime(item.end_time)}</span
						>
					</div>

						<div class="flex w-full items-center gap-4">
						{#if item.start_time && item.end_time}
							<div class="relative h-4 w-full overflow-hidden rounded-sm bg-error/20">
								<div
									class="absolute bottom-0 top-0 bg-green"
									style="
										left: {Math.max(0, (parseInt(item.start_time.split(':')[0]) - 5) / 15) * 100}%;
										width: {Math.min(
										1,
										(parseInt(item.end_time.split(':')[0]) -
											parseInt(item.start_time.split(':')[0])) /
											15
									) * 100}%;
									"
								></div>
							</div>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm italic text-gray-400">Inga datum tillagda ännu.</p>
	{/if}
</div>
