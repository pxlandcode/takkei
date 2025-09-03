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

	// API
	import { fetchTargetSummary } from '$lib/services/api/targetService';

	// Types
	import type { User as TUser } from '$lib/types/userTypes';
	import type { Location as TLocation } from '$lib/stores/locationsStore';

	let month = new Date().toISOString().slice(0, 7); // "YYYY-MM"

	// Selected filters (multi)
	let selectedUsers: TUser[] = [];
	let selectedLocations: TLocation[] = [];

	let loading = false;
	let summary: any = { trainers: [], locations: [], total: { target: 0, achieved: 0 } };

	onMount(async () => {
		await Promise.all([fetchUsers(), fetchLocations()]);
		await refreshSummary(); // default (no trainer/location filters)
	});

	function monthBounds(ym: string) {
		const start = new Date(ym + '-01T00:00:00');
		const end = new Date(start);
		end.setMonth(end.getMonth() + 1);
		end.setDate(0);
		end.setHours(23, 59, 59, 999);
		return { start, end };
	}

	async function refreshSummary() {
		loading = true;
		try {
			const { start, end } = monthBounds(month);
			const trainerIds = selectedUsers.map((u) => u.id).join(',');
			const locationIds = selectedLocations.map((l) => l.id).join(',');

			const qs = new URLSearchParams({
				from: start.toISOString().slice(0, 10),
				to: end.toISOString().slice(0, 10),
				trainerIds,
				locationIds
			});
			summary = await fetchTargetSummary(qs.toString());

			console.log('Fetched summary:', summary);
		} finally {
			loading = false;
		}
	}

	/* ===== Dropdown handlers / helpers (copied style) ===== */
	function handleUserSelection(e) {
		selectedUsers = [...e.detail.selected];
	}
	function handleLocationSelection(e) {
		selectedLocations = [...e.detail.selected];
	}

	function onSelectAllUsers() {
		selectedUsers = get(users);
	}
	function onDeSelectAllUsers() {
		selectedUsers = [];
	}
	function onSelectAllLocations() {
		selectedLocations = get(locations);
	}
	function onDeSelectAllLocations() {
		selectedLocations = [];
	}
	function onSelectMe() {
		const all = get(users);
		const me = all.find((u) => u.id === get(user)?.id);
		if (me) selectedUsers = [me];
	}
	function onSelectMyPrimaryLocation() {
		const alls = get(locations);
		const me = get(user);
		const primary = alls.find((l) => l.id === me?.default_location_id);
		if (primary) selectedLocations = [primary];
	}

	function applyFilters() {
		// Explicit click to fetch (like your filter modal)
		refreshSummary();
	}
</script>

<div class="space-y-6 p-2">
	<h3 class="text-xl font-semibold">Mål & Utmärkelser</h3>

	<!-- Month selector -->
	<div class="grid gap-3 sm:grid-cols-4">
		<div>
			<label class="text-sm">Månad</label>
			<input
				type="month"
				bind:value={month}
				class="mt-1 w-full rounded border p-2"
				on:change={refreshSummary}
			/>
		</div>
	</div>

	<!-- Trainer / Location filters (DropdownCheckbox + buttons) -->
	<div class="flex flex-col gap-4">
		<div class="flex flex-row gap-2">
			<DropdownCheckbox
				label="Tränare"
				placeholder="Välj tränare"
				id="report-users"
				options={($users || []).map((u) => ({
					name: `${u.firstname} ${u.lastname}`,
					value: u
				}))}
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

		<!-- FilterBox showing current selections -->
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
	{:else}
		<!-- Summary tables -->
		<div class="grid gap-6 md:grid-cols-2">
			<div class="rounded-2xl border p-4">
				<h4 class="mb-2 font-medium">Individuella mål</h4>
				{#if summary.trainers.length === 0}
					<p class="text-sm text-gray-500">Inga tränarmål för vald period.</p>
				{:else}
					<table class="w-full text-sm">
						<thead
							><tr class="text-left"
								><th class="py-1">Tränare</th><th>Mål</th><th>Utfört</th><th>Diff</th></tr
							></thead
						>
						<tbody>
							{#each summary.trainers as r}
								<tr class="border-t">
									<td class="py-1">{r.name}</td>
									<td>{r.target}</td>
									<td>{r.achieved}</td>
									<td class={r.achieved >= r.target ? 'text-green-600' : 'text-red-600'}
										>{r.achieved - r.target}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>

			<div class="rounded-2xl border p-4">
				<h4 class="mb-2 font-medium">Platsmål</h4>
				{#if summary.locations.length === 0}
					<p class="text-sm text-gray-500">Inga platsmål för vald period.</p>
				{:else}
					<table class="w-full text-sm">
						<thead
							><tr class="text-left"
								><th class="py-1">Plats</th><th>Mål</th><th>Utfört</th><th>Diff</th></tr
							></thead
						>
						<tbody>
							{#each summary.locations as r}
								<tr class="border-t">
									<td class="py-1">{r.name}</td>
									<td>{r.target}</td>
									<td>{r.achieved}</td>
									<td class={r.achieved >= r.target ? 'text-green-600' : 'text-red-600'}
										>{r.achieved - r.target}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</div>

		<div class="rounded-2xl border p-4">
			<h4 class="mb-2 font-medium">Totalt ({month})</h4>
			<div class="text-sm">
				Mål: <strong>{summary.total.target}</strong> &nbsp; Utfört:
				<strong>{summary.total.achieved}</strong>
				&nbsp; Diff:
				<strong
					class={summary.total.achieved >= summary.total.target ? 'text-green-600' : 'text-red-600'}
				>
					{summary.total.achieved - summary.total.target}
				</strong>
			</div>
		</div>
	{/if}
</div>
