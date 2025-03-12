<script lang="ts">
	import { writable, get } from 'svelte/store';
	import type { TableType } from '$lib/types/componentTypes';
	import Button from '../button/Button.svelte';
	import Icon from '../icon-component/Icon.svelte';
	import { IconArrowDown } from '$icons';

	// Props for headers and table data
	export let headers: {
		label: string;
		key: string;
		icon?: string;
		iconSize?: string;
		sort?: boolean;
	}[] = [];
	export let data: TableType = [];

	// Sorting state
	let sortedColumn: string | null = null;
	let sortOrder: 'asc' | 'desc' = 'asc';

	// Store for sorted data
	const sortedData = writable([...data]);

	// Update sortedData when new data is received
	$: sortedData.set([...data]);

	// Sorting function
	function sortTable(columnKey: string) {
		if (sortedColumn === columnKey) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortedColumn = columnKey;
			sortOrder = 'asc';
		}

		// Sort data dynamically based on key
		sortedData.set(
			[...get(sortedData)].sort((a, b) => {
				const aValue = a[columnKey] || '';
				const bValue = b[columnKey] || '';

				if (typeof aValue === 'string' && typeof bValue === 'string') {
					return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
				}
				if (typeof aValue === 'number' && typeof bValue === 'number') {
					return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
				}
				return 0;
			})
		);
	}
</script>

<!-- Desktop Table -->
<div class="overflow-x-auto border-gray sm:rounded-xl lg:border lg:shadow-md">
	<table class="hidden w-full table-fixed lg:table">
		<thead class="rounded-t-lg bg-gray text-left text-white">
			<tr>
				<th class="w-12 rounded-tl-lg p-4">
					<input type="checkbox" class="h-5 w-5 rounded border-gray" />
				</th>
				{#each headers as header}
					<th
						class="{header.sort ? 'cursor-pointer' : ''} items-center gap-2 p-4"
						on:click={() => header.sort && sortTable(header.key)}
					>
						{#if header.icon}
							<span class="p-2">
								<Icon icon={header.icon} size={header.iconSize ? header.iconSize : '15px'} />
							</span>
						{/if}
						{header.label}
						{#if header.sort}
							<span class="p-2">
								{#if sortedColumn === header.key}
									<IconArrowDown
										size="12px"
										extraClasses={`transform transition-all duration-300 text-white
                                    ${sortOrder === 'asc' ? ' ' : 'rotate-180'}`}
									/>
								{/if}
								{#if sortedColumn !== header.key}
									<Icon icon="Sort" size="16px" />
								{/if}
							</span>
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-bright bg-white">
			{#each $sortedData as row}
				<tr class="hover:bg-gray-100">
					<td class="p-4">
						<input type="checkbox" class="h-5 w-5 rounded border-gray" />
					</td>
					{#each headers as header}
						<td class="p-4">
							{#if Array.isArray(row[header.key])}
								<div class="flex flex-row flex-wrap gap-2">
									{#each row[header.key] as item}
										{#if item.type === 'button'}
											<Button
												on:click={item.action}
												text={item.label}
												iconLeft={item.label ? item.icon : undefined}
												iconLeftSize="14px"
												variant={item.variant}
												icon={item.label ? undefined : item.icon}
											/>
										{:else}
											<p class="text-gray-700">{item.content}</p>
										{/if}
									{/each}
								</div>
							{:else}
								{row[header.key] || '-'}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>

	<!-- Mobile View (Stacked Rows) -->
	<div class="flex flex-col gap-4 p-4 lg:hidden">
		{#each $sortedData as row}
			<div class="rounded-lg border border-gray p-4 shadow-md">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold">{row[headers[0].key]}</h3>
					<input type="checkbox" class="h-5 w-5 rounded border-gray" />
				</div>
				{#each headers as header, i}
					{#if i > 0}
						<!-- Skip first column since it's shown as title -->
						<div class="mt-2">
							<p class="text-sm text-gray-600"><strong>{header.label}:</strong></p>
							{#if Array.isArray(row[header.key])}
								<div class="flex flex-row flex-wrap gap-2">
									{#each row[header.key] as item}
										{#if item.type === 'button'}
											<Button
												on:click={item.action}
												text={item.label}
												iconLeft={item.label ? item.icon : undefined}
												variant={item.variant}
												icon={item.label ? undefined : item.icon}
											/>
										{:else}
											<p class="text-gray-700">{item.content}</p>
										{/if}
									{/each}
								</div>
							{:else}
								<p class="text-gray-700">{row[header.key] || '-'}</p>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
</div>
