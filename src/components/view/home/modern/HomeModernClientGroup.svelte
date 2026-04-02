<script lang="ts">
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { getClientFullName, getLastBookedText, isOverSixWeeksAgo } from './homeModernUtils';
	import type { HomeModernClient } from './homeModernTypes';

	export let label: string;
	export let clients: HomeModernClient[] = [];
	export let chipClass = 'bg-gray-100 text-gray-600 hover:bg-gray-200';
	export let maxVisible = 4;

	let showAllClients = false;

	$: hiddenClientCount = Math.max(clients.length - maxVisible, 0);
	$: visibleClients = showAllClients ? clients : clients.slice(0, maxVisible);
	$: if (hiddenClientCount === 0 && showAllClients) {
		showAllClients = false;
	}

	function toggleShowAllClients() {
		showAllClients = !showAllClients;
	}
</script>

<div>
	<p class="mb-2 text-xs font-semibold tracking-wide text-gray-600 uppercase">
		{label} ({clients.length})
	</p>
	<div class="flex flex-wrap gap-1">
		{#each visibleClients as client (client.id)}
			<a
				href="/clients/{client.id}"
				class={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium transition ${chipClass}`}
			>
				<span>{getClientFullName(client)}</span>
				{#if isOverSixWeeksAgo(client.lastBookingDate)}
					<span
						use:tooltip={{ content: getLastBookedText(client.lastBookingDate) }}
						class="text-red inline-flex cursor-help"
					>
						<Icon icon="CircleAlert" size="12px" />
					</span>
				{/if}
			</a>
		{/each}
		{#if hiddenClientCount > 0}
			<button
				type="button"
				class="text-primary inline-flex items-center px-2 py-1 text-xs font-medium transition hover:underline"
				on:click={toggleShowAllClients}
				aria-expanded={showAllClients}
				aria-label={showAllClients
					? `Visa färre klienter i ${label.toLowerCase()}`
					: `Visa ${hiddenClientCount} fler klienter i ${label.toLowerCase()}`}
			>
				{showAllClients ? 'Visa färre' : `+${hiddenClientCount}`}
			</button>
		{/if}
	</div>
</div>
