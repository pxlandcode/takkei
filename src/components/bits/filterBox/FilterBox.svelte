<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let selectedUsers = [];
	export let selectedLocations = [];
	export let selectedClients = [];
	export let selectedEmails: string[] = [];
	export let title: string = 'Filter';

	const dispatch = createEventDispatcher();

	function removeFilter(type, id) {
		dispatch('removeFilter', { type, id });
	}
</script>

<!-- Filter Box -->
<div class="filter-box">
	<span class="text-sm text-gray-medium">{title}:</span>

	{#each selectedEmails as email}
		<span class="filter-pill email-pill">
			{email}
			<span class="remove-button" on:click={() => removeFilter('email', email)}>×</span>
		</span>
	{/each}

	<!-- Trainers -->
	{#each selectedUsers as user}
		<span class="filter-pill trainer-pill">
			{user.firstname}
			{user.lastname}
			<span class="remove-button" on:click={() => removeFilter('trainer', user.id)}>×</span>
		</span>
	{/each}

	<!-- Locations -->
	{#each selectedLocations as location}
		<span class="filter-pill location-pill">
			{location.name}
			<span class="remove-button" on:click={() => removeFilter('location', location.id)}>×</span>
		</span>
	{/each}

	<!-- Clients -->
	{#each selectedClients as client}
		<span class="filter-pill client-pill">
			{client.firstname}
			{client.lastname}
			<span class="remove-button" on:click={() => removeFilter('client', client.id)}>×</span>
		</span>
	{/each}
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
