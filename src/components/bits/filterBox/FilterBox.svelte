<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let selectedUsers = [];
	export let selectedLocations = [];
	export let selectedClients = [];
	export let selectedEmails: string[] = [];
	export let title: string = 'Filter';

	const dispatch = createEventDispatcher();
	let showAll = false;

	function removeFilter(type, id) {
		dispatch('removeFilter', { type, id });
	}

	// Unified list
	$: allFilters = [
		...selectedEmails.map((email) => ({
			type: 'email',
			label: email,
			id: email,
			pill: 'email-pill'
		})),
		...selectedUsers.map((user) => ({
			type: 'trainer',
			label: `${user.firstname} ${user.lastname}`,
			id: user.id,
			pill: 'trainer-pill'
		})),
		...selectedLocations.map((location) => ({
			type: 'location',
			label: location.name,
			id: location.id,
			pill: 'location-pill'
		})),
		...selectedClients.map((client) => ({
			type: 'client',
			label: `${client.firstname} ${client.lastname}`,
			id: client.id,
			pill: 'client-pill'
		}))
	];
</script>

<div
	class="filter-box relative transition-all duration-500"
	class:max-h-32={!showAll}
	class:overflow-hidden={!showAll}
	style="padding-bottom: {allFilters.length > 10 && showAll ? '3rem' : ''}"
>
	<span class="text-sm text-gray-medium">{title}:</span>

	{#each allFilters as item (item.type + item.id)}
		<span class="filter-pill {item.pill ?? 'email-pill'}">
			{item.label}
			<span class="remove-button" on:click={() => removeFilter(item.type, item.id)}>×</span>
		</span>
	{/each}

	{#if allFilters.length > 10}
		<!-- Fade + Toggle -->
		<div
			class="fade-footer pointer-events-none absolute bottom-0 left-0 flex w-full justify-center"
		>
			<div class="h-16 w-full bg-gradient-to-t from-white via-white/80 to-transparent"></div>
		</div>

		<button
			on:click={() => (showAll = !showAll)}
			class="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded bg-white px-3 py-1 text-sm text-blue-600 underline hover:text-blue-800"
		>
			{showAll ? 'Visa färre –' : 'Visa mer +'}
		</button>
	{/if}
</div>

<style>
	.filter-box {
		@apply flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gray-bright bg-gray-bright/10 p-3;
	}
	.filter-pill {
		@apply flex items-center gap-2 rounded-full border border-dashed px-3 py-1 text-sm;
	}
	.email-pill {
		@apply border-gray-500 bg-gray-500/10 text-gray-500;
	}
	.trainer-pill {
		@apply border-orange bg-orange/10 text-orange;
	}
	.location-pill {
		@apply border-blue-500 bg-blue-500/10 text-blue-500;
	}
	.client-pill {
		@apply border-green bg-green/10 text-green;
	}
	.remove-button {
		@apply cursor-pointer text-sm font-bold;
	}
</style>
