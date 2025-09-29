<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';

	// Stores
	import { user } from '$lib/stores/userStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';

	// UI bits
	import Button from '../../../bits/button/Button.svelte';
	import DropdownCheckbox from '../../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import FilterBox from '../../../bits/filterBox/FilterBox.svelte';
	import GoalAchievedBar from '../../../bits/bars/GoalAchievedBar.svelte';

	// API (expects the new split+combined shape)
	import { fetchTargetsAggregate } from '$lib/services/api/targetAggregateService';

	// Types
	import type { User as TUser } from '$lib/types/userTypes';
	import type { Location as TLocation } from '$lib/stores/locationsStore';

	// Helpers
	const svMonthName = (m: number) =>
		new Date(2000, m - 1, 1).toLocaleDateString('sv-SE', { month: 'long' });

	/* ───────────────────────────────── UI STATE ───────────────────────────────── */

	let selectedYear = new Date().getFullYear();
	let yearsForSummary: number[] = [selectedYear - 2, selectedYear - 1, selectedYear].filter(
		(y) => y > 1999
	);

	let selectedUsers: TUser[] = [];
	let selectedLocations: TLocation[] = [];

	let loading = false;

	// matches the new backend payload (trainers/locations/combined)
	type MonthRow = {
		month: number;
		trainers: { goal: number; achieved: number };
		locations: { goal: number; achieved: number };
		combined: { goal: number; achieved: number };
	};

	type YearRow = {
		year: number;
		trainers: { goal: number; achieved: number };
		locations: { goal: number; achieved: number };
		combined: { goal: number; achieved: number };
	};

	let data: {
		year: number;
		months: MonthRow[];
		yearTotals: YearRow[];
		selection: { trainerIds: number[]; locationIds: number[] };
	} | null = null;

	onMount(async () => {
		await Promise.all([fetchUsers(), fetchLocations()]);
		await refresh();
	});

	/* ─────────────────────────────── Helpers ─────────────────────────────── */

	// Normalize what comes from DropdownCheckbox; accept either the raw entity or { value: entity }
	function normalizeSelected<T extends { id: number }>(arr: any[]): T[] {
		return (arr ?? [])
			.map((x) => (x && typeof x === 'object' && 'id' in x ? x : x?.value))
			.filter((v) => v && typeof v.id === 'number') as T[];
	}

	function ids(arr: Array<{ id: number }> | null | undefined): number[] {
		return (arr ?? []).map((x) => Number(x.id)).filter((n) => Number.isFinite(n) && n > 0);
	}

	function emptyPayload(year: number) {
		const zero = { goal: 0, achieved: 0 };
		return {
			year,
			months: Array.from({ length: 12 }, (_, i) => ({
				month: i + 1,
				trainers: { ...zero },
				locations: { ...zero },
				combined: { ...zero }
			})),
			yearTotals: [{ year, trainers: { ...zero }, locations: { ...zero }, combined: { ...zero } }],
			selection: { trainerIds: [], locationIds: [] }
		};
	}

	async function refresh() {
		loading = true;
		try {
			const trainerIds = ids(selectedUsers);
			const locationIds = ids(selectedLocations);

			// Only fetch if at least one side selected
			if (trainerIds.length === 0 && locationIds.length === 0) {
				data = emptyPayload(selectedYear);
				return;
			}

			data = await fetchTargetsAggregate({
				year: selectedYear,
				trainerIds,
				locationIds,
				years: yearsForSummary.length ? yearsForSummary : [selectedYear]
			});
		} finally {
			loading = false;
		}
	}

	/* ───────────────────────── Dropdown handlers ───────────────────────── */

	function handleUserSelection(e) {
		selectedUsers = normalizeSelected<TUser>(e.detail.selected);
	}
	function handleLocationSelection(e) {
		selectedLocations = normalizeSelected<TLocation>(e.detail.selected);
	}

	function onSelectAllUsers() {
		selectedUsers = get(users) ?? [];
	}
	function onDeSelectAllUsers() {
		selectedUsers = [];
	}
	function onSelectAllLocations() {
		selectedLocations = get(locations) ?? [];
	}
	function onDeSelectAllLocations() {
		selectedLocations = [];
	}
	function onSelectMe() {
		const me = get(user);
		const all = get(users) ?? [];
		const mine = all.find((u) => u.id === me?.id);
		if (mine) selectedUsers = [mine];
	}
	function onSelectMyPrimaryLocation() {
		const me = get(user);
		const alls = get(locations) ?? [];
		const primary = alls.find((l) => l.id === me?.default_location_id);
		if (primary) selectedLocations = [primary];
	}

	function applyFilters() {
		refresh();
	}

	/* ──────────────────────────── Scales for bars ─────────────────────────── */

	// Consider trainers, locations, and combined so widths are comparable
	$: monthScaleMax = data
		? Math.max(
				1,
				...data.months.flatMap((m) => [
					Math.max(m.trainers.goal, m.trainers.achieved),
					Math.max(m.locations.goal, m.locations.achieved),
					Math.max(m.combined.goal, m.combined.achieved)
				])
			)
		: 1;

	$: yearScaleMax = data
		? Math.max(
				1,
				...data.yearTotals.flatMap((y) => [
					Math.max(y.trainers.goal, y.trainers.achieved),
					Math.max(y.locations.goal, y.locations.achieved),
					Math.max(y.combined.goal, y.combined.achieved)
				])
			)
		: 1;
</script>

<div class="space-y-6 p-2">
	<h3 class="text-xl font-semibold">Mål – Översikt</h3>

	<!-- Year and years-for-summary -->
	<div class="grid gap-3 sm:grid-cols-4">
		<div>
			<label class="text-sm">År</label>
			<input
				type="number"
				min="2000"
				max="2100"
				bind:value={selectedYear}
				class="mt-1 w-full rounded-sm border p-2"
				on:change={() => {
					yearsForSummary = [selectedYear - 2, selectedYear - 1, selectedYear].filter(
						(y) => y > 1999
					);
					refresh();
				}}
			/>
		</div>

		<div class="sm:col-span-3">
			<label class="text-sm">Visa år (summering)</label>
			<div class="mt-1 flex flex-wrap items-center gap-2">
				{#each yearsForSummary as y}
					<span class="rounded-sm border px-2 py-1 text-sm">{y}</span>
				{/each}
				<button
					type="button"
					class="rounded-sm border px-2 py-1 text-xs hover:bg-gray-50"
					on:click={() => {
						const y = selectedYear + 1;
						if (!yearsForSummary.includes(y)) yearsForSummary = [...yearsForSummary, y];
					}}
					title="Lägg till nästa år">+ år</button
				>
				<button
					type="button"
					class="rounded-sm border px-2 py-1 text-xs hover:bg-gray-50"
					on:click={() => {
						if (yearsForSummary.length > 1) yearsForSummary = yearsForSummary.slice(0, -1);
					}}
					title="Ta bort sista">– år</button
				>
			</div>
		</div>
	</div>

	<!-- Filters -->
	<div class="flex flex-col gap-4">
		<div class="flex flex-row gap-2">
			<DropdownCheckbox
				label="Tränare"
				placeholder="Välj tränare"
				id="report-users"
				options={($users || []).map((u) => ({ name: `${u.firstname} ${u.lastname}`, value: u }))}
				maxNumberOfSuggestions={15}
				infiniteScroll
				search
				bind:selectedValues={selectedUsers}
				on:change={handleUserSelection}
			/>
			<div class="mt-7 flex flex-row gap-2">
				<Button
					icon="Person"
					iconColor="orange"
					iconSize="16"
					variant="secondary"
					on:click={onSelectMe}
				/>
				<Button
					icon="MultiCheck"
					variant="secondary"
					on:click={onSelectAllUsers}
					iconColor="green"
				/>
				<Button icon="Trash" iconColor="error" variant="secondary" on:click={onDeSelectAllUsers} />
			</div>
		</div>

		<div class="flex flex-row gap-2">
			<DropdownCheckbox
				label="Plats"
				placeholder="Välj plats"
				id="report-locations"
				options={($locations || []).map((l) => ({ name: l.name, value: l }))}
				maxNumberOfSuggestions={15}
				infiniteScroll
				bind:selectedValues={selectedLocations}
				on:change={handleLocationSelection}
			/>
			<div class="mt-7 flex flex-row gap-2">
				<Button
					icon="Building"
					iconColor="orange"
					iconSize="16"
					variant="secondary"
					on:click={onSelectMyPrimaryLocation}
				/>
				<Button
					icon="MultiCheck"
					variant="secondary"
					on:click={onSelectAllLocations}
					iconColor="green"
				/>
				<Button
					icon="Trash"
					iconColor="error"
					variant="secondary"
					on:click={onDeSelectAllLocations}
				/>
			</div>
		</div>

		<FilterBox
			{selectedUsers}
			{selectedLocations}
			on:removeFilter={(e) => {
				const { type, id } = e.detail;
				if (type === 'trainer') selectedUsers = selectedUsers.filter((u) => u.id !== id);
				if (type === 'location') selectedLocations = selectedLocations.filter((l) => l.id !== id);
			}}
		/>

		<div class="flex">
			<Button
				full
				variant="primary"
				text="Filtrera"
				iconLeft="Filter"
				iconLeftSize="16px"
				on:click={applyFilters}
			/>
		</div>
	</div>

	{#if loading}
		<div class="rounded-2xl border p-6 text-sm text-gray-500">Laddar...</div>
	{:else if data}
		<!-- Monthly (selected year) -->
		<div class="rounded-2xl border p-4">
			<h4 class="mb-2 font-medium">Månader {data.year}</h4>
			<div class="space-y-3">
				{#each data.months as m}
					<div class="space-y-1">
						<div class="text-xs text-gray-500">{svMonthName(m.month)}</div>
						<GoalAchievedBar
							label="Tränare"
							goal={m.trainers.goal}
							achieved={m.trainers.achieved}
							scaleMax={monthScaleMax}
						/>
						<GoalAchievedBar
							label="Plats"
							goal={m.locations.goal}
							achieved={m.locations.achieved}
							scaleMax={monthScaleMax}
						/>
						<GoalAchievedBar
							label="Totalt"
							goal={m.combined.goal}
							achieved={m.combined.achieved}
							scaleMax={monthScaleMax}
						/>
					</div>
				{/each}
			</div>
			<div class="mt-3 text-sm">
				<span class="inline-block rounded-sm bg-green-500/20 px-2 py-0.5 text-green-700">Utfört</span>
				<span class="ml-2 inline-block rounded-sm bg-blue-300/30 px-2 py-0.5 text-blue-700">Mål</span>
				<span class="ml-2 text-xs text-gray-500"
					>(Totalt = union av bokningar, utan dubbelräkning)</span
				>
			</div>
		</div>

		<!-- Years summary -->
		<div class="rounded-2xl border p-4">
			<h4 class="mb-2 font-medium">År (sammanställning)</h4>
			<div class="space-y-3">
				{#each data.yearTotals as y}
					<div class="space-y-1">
						<div class="text-xs text-gray-500">{y.year}</div>
						<GoalAchievedBar
							label="Tränare"
							goal={y.trainers.goal}
							achieved={y.trainers.achieved}
							scaleMax={yearScaleMax}
						/>
						<GoalAchievedBar
							label="Plats"
							goal={y.locations.goal}
							achieved={y.locations.achieved}
							scaleMax={yearScaleMax}
						/>
						<GoalAchievedBar
							label="Totalt"
							goal={y.combined.goal}
							achieved={y.combined.achieved}
							scaleMax={yearScaleMax}
						/>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="rounded-2xl border p-6 text-sm text-gray-500">Ingen data.</div>
	{/if}
</div>
