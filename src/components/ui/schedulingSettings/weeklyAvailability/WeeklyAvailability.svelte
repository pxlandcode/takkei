<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '../../../bits/button/Button.svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import { confirm } from '$lib/actions/confirm';

	export let weeklyAvailability = [];
	export let canEdit: () => boolean;
	export let userId: number | null = null;

	let editing = false;
	const dispatch = createEventDispatcher();

	const weekdays = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

	let fullWeekAvailability = [];

	// Build local model from incoming rows
	$: fullWeekAvailability = Array.from({ length: 7 }, (_, i) => {
		const weekday = i === 6 ? 0 : i + 1; // DB: 1..6,0 (Sun=0)
		const match = weeklyAvailability.find((d) => d.weekday === weekday);
		return {
			id: match?.id ?? null,
			userId,
			weekday,
			start_time: match?.start_time || match?.from || '',
			end_time: match?.end_time || match?.to || ''
		};
	});

	function weekdayLabel(weekday: number) {
		return weekdays[weekday === 0 ? 6 : weekday - 1];
	}

	function checkAvailableWholeDayByIndex(i: number) {
		fullWeekAvailability[i] = {
			...fullWeekAvailability[i],
			start_time: '',
			end_time: ''
		};

		fullWeekAvailability = [...fullWeekAvailability];
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-md">
	<!-- Header -->
	<div class="mb-3 flex items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<div class="flex h-6 w-6 items-center justify-center rounded-full bg-text text-white">
				<Icon icon="Calendar" size="14px" />
			</div>
			<h3 class="text-lg font-semibold text-text">Veckoschema</h3>
		</div>

		{#if canEdit()}
			{#if editing}
				<Button
					text="Spara schema"
					on:click={() => {
						editing = false;

						dispatch('save', fullWeekAvailability);
					}}
				/>
			{:else}
				<Button text="Redigera" on:click={() => (editing = true)} />
			{/if}
		{/if}
	</div>

	<!-- Hour Labels -->
	<div class="ml-[343px] hidden justify-between text-xs text-gray-500 lg:flex">
		{#each [5, 8, 11, 14, 17, 20] as h}
			<span>{h}</span>
		{/each}
	</div>

	<!-- Schedule Grid -->
	<div
		class="grid gap-x-4 gap-y-4"
		style="grid-template-columns: 1px 1px 45px 1px  90px 1px 90px 1fr;"
	>
		{#each fullWeekAvailability as day, i}
			{#if editing}
				<button
					use:confirm={{
						title: 'Tillgänglig hela dagen',
						description: `Vill du markera ${weekdayLabel(day.weekday)}ar som tillgänglig hela dagen?`,
						action: () => checkAvailableWholeDayByIndex(i)
					}}
					class="cursor-pointer text-success transition hover:scale-110"
					aria-label="Tillgänglig hela dagen"
				>
					<Icon icon="CalendarCheck" size="18" />
				</button>
			{:else}
				<span></span>
			{/if}
			<span></span>
			<div class="flex items-center text-sm font-medium text-gray-700">
				{weekdays[day.weekday === 0 ? 6 : day.weekday - 1]}
			</div>
			<span></span>
			{#if canEdit()}
				<input
					type="time"
					step="900"
					class="input"
					bind:value={day.start_time}
					disabled={!editing}
				/>
				<div class="flex items-center justify-center text-sm">–</div>
				<input type="time" step="900" class="input" bind:value={day.end_time} disabled={!editing} />
			{:else}
				<div class="col-span-3 flex items-center text-sm text-gray-500">
					{#if day.start_time && day.end_time}
						{day.start_time} – {day.end_time}
					{:else}
						Ej tillgänglig
					{/if}
				</div>
			{/if}

			<div class="hidden h-full items-center lg:flex">
				<div class="relative h-4 w-full overflow-hidden rounded-sm bg-error/20">
					{#if day.start_time && day.end_time}
						<div
							class="absolute bottom-0 top-0 bg-green"
							style="
                        left: {Math.max(0, (parseInt(day.start_time.split(':')[0]) - 5) / 15) *
								100}%;
                        width: {Math.min(
								1,
								(parseInt(day.end_time.split(':')[0]) - parseInt(day.start_time.split(':')[0])) / 15
							) * 100}%;
                    "
						/>
					{:else}
						<div class="absolute bottom-0 top-0 w-full bg-green" />
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.input {
		@apply w-full rounded border px-2 py-1 text-sm;
	}
</style>
