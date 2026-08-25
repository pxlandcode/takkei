<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	type FilterType = 'email' | 'trainer' | 'location' | 'client';
	type FilterId = number | string;
	type FilterItem = {
		type: FilterType;
		label: string;
		id: FilterId;
	};
	type PersonFilter = {
		id: FilterId;
		firstname?: string | null;
		lastname?: string | null;
	};
	type LocationFilter = {
		id: FilterId;
		name?: string | null;
	};

	export let selectedUsers: PersonFilter[] = [];
	export let selectedLocations: LocationFilter[] = [];
	export let selectedClients: PersonFilter[] = [];
	export let selectedEmails: string[] = [];
	export let title: string = 'Filter';
	export let getFilterHref: (item: FilterItem) => string | undefined = () => undefined;

	const dispatch = createEventDispatcher();
	let showAll = false;

	const filterBoxBaseClass =
		'relative flex flex-wrap items-center gap-2 rounded-sm border border-dashed border-gray-bright bg-gray-bright/10 p-3 transition-all duration-500';
	const pillBaseClass =
		'flex items-center gap-2 rounded-full border border-dashed px-3 py-1 text-sm';
	const pillAccentClass: Record<string, string> = {
		email: 'border-gray-500 bg-gray-500/10 text-gray-500',
		trainer: 'border-orange bg-orange/10 text-orange',
		location: 'border-blue-500 bg-blue-500/10 text-blue-500',
		client: 'border-green bg-green/10 text-green'
	};
	const removeButtonClass = 'cursor-pointer text-sm font-bold leading-none';

	const defaultPillAccentClass = pillAccentClass.email;
	const linkClass =
		'underline-offset-2 transition-colors hover:text-orange hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

	function removeFilter(type: FilterType, id: FilterId) {
		dispatch('removeFilter', { type, id });
	}

	function getPersonLabel(person: PersonFilter): string {
		return [person.firstname, person.lastname].filter(Boolean).join(' ').trim() || 'Namnlös';
	}

	function getLocationLabel(location: LocationFilter): string {
		return location.name?.trim() || 'Namnlös plats';
	}

	// Unified list containing all filter selections
	$: allFilters = [
		...selectedEmails.map(
			(email): FilterItem => ({
				type: 'email',
				label: email,
				id: email
			})
		),
		...selectedUsers.map(
			(user): FilterItem => ({
				type: 'trainer',
				label: getPersonLabel(user),
				id: user.id
			})
		),
		...selectedLocations.map(
			(location): FilterItem => ({
				type: 'location',
				label: getLocationLabel(location),
				id: location.id
			})
		),
		...selectedClients.map(
			(client): FilterItem => ({
				type: 'client',
				label: getPersonLabel(client),
				id: client.id
			})
		)
	];
</script>

<div
	class={filterBoxBaseClass}
	class:max-h-32={!showAll}
	class:overflow-hidden={!showAll}
	style="padding-bottom: {allFilters.length > 10 && showAll ? '3rem' : ''}"
>
	<span class="text-gray-medium text-sm">{title}:</span>

	{#each allFilters as item (item.type + item.id)}
		{@const href = getFilterHref(item)}
		<span class={`${pillBaseClass} ${pillAccentClass[item.type] ?? defaultPillAccentClass}`}>
			{#if href}
				<a {href} class={linkClass}>{item.label}</a>
			{:else}
				<span>{item.label}</span>
			{/if}
			<button
				type="button"
				class={removeButtonClass}
				aria-label={`Ta bort ${item.label}`}
				on:click={() => removeFilter(item.type, item.id)}
			>
				×
			</button>
		</span>
	{/each}

	{#if allFilters.length > 10}
		<!-- Fade + Toggle -->
		<div
			class="fade-footer pointer-events-none absolute bottom-0 left-0 flex w-full justify-center"
		>
			<div class="h-16 w-full bg-linear-to-t from-white via-white/80 to-transparent"></div>
		</div>

		<button
			on:click={() => (showAll = !showAll)}
			class="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-sm bg-white px-3 py-1 text-sm text-blue-600 underline hover:text-blue-800"
		>
			{showAll ? 'Visa färre –' : 'Visa mer +'}
		</button>
	{/if}
</div>
