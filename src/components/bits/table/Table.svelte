<script lang="ts">
	import { writable } from 'svelte/store';
	import type { TableType } from '$lib/types/componentTypes';
	import Button from '../button/Button.svelte';
	import Icon from '../icon-component/Icon.svelte';
	import { IconArrowDown } from '$icons';
	import { createEventDispatcher } from 'svelte';
	import { tooltip } from '$lib/actions/tooltip';

	const dispatch = createEventDispatcher();

	export let sideScrollable = false;

	export let headers: {
		label: string;
		key: string;
		icon?: string;
		iconSize?: string;
		sort?: boolean;
		width?: string;
	}[] = [];

	export let data: TableType = [];

	export let noSelect = true;

	let sortedColumn: string | null = null;
	let sortOrder: 'asc' | 'desc' = 'asc';
	let titleHeaderIndex = 0;

	const sortedData = writable([...data]);

	function normalizeSortableValue(value: unknown): string {
		if (value === null || value === undefined) {
			return '';
		}

		if (typeof value === 'string') {
			return value.toLocaleLowerCase();
		}

		if (typeof value === 'number') {
			return value.toString();
		}

		if (typeof value === 'boolean') {
			return value ? '1' : '0';
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				if (item === null || item === undefined) {
					continue;
				}

				if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
					const text = normalizeSortableValue(item);
					if (text) return text;
				}

				if (typeof item === 'object') {
					const objectItem = item as Record<string, unknown>;
					const candidates = ['label', 'content', 'value', 'text'];
					for (const key of candidates) {
						if (key in objectItem) {
							const text = normalizeSortableValue(objectItem[key]);
							if (text) return text;
						}
					}
				}
			}
			return '';
		}

		if (typeof value === 'object') {
			const objectValue = value as Record<string, unknown>;
			const fallbackKeys = ['label', 'content', 'value', 'text'];
			for (const key of fallbackKeys) {
				if (key in objectValue) {
					const text = normalizeSortableValue(objectValue[key]);
					if (text) return text;
				}
			}
			return '';
		}

		return String(value);
	}

	function formatCellDisplay(value: unknown): string {
		if (value === null || value === undefined || value === '') {
			return '-';
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				if (item === null || item === undefined) {
					continue;
				}

				if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
					return String(item);
				}

				if (typeof item === 'object') {
					const objectItem = item as Record<string, unknown>;
					const candidates = ['label', 'content', 'value', 'text'];
					for (const key of candidates) {
						const candidate = objectItem[key];
						if (candidate !== undefined && candidate !== null && candidate !== '') {
							return String(candidate);
						}
					}
				}
			}
			return '-';
		}

		if (value instanceof Date) {
			return value.toLocaleString();
		}

		if (typeof value === 'object') {
			const objectValue = value as Record<string, unknown>;
			const candidates = ['label', 'content', 'value', 'text'];
			for (const key of candidates) {
				const candidate = objectValue[key];
				if (candidate !== undefined && candidate !== null && candidate !== '') {
					return String(candidate);
				}
			}
			return '-';
		}

		return String(value);
	}

	function sortRowsInPlace(rows: TableType, columnKey: string, order: 'asc' | 'desc') {
		const direction = order === 'asc' ? 1 : -1;

		rows.sort((a, b) => {
			const left = normalizeSortableValue(a[columnKey]);
			const right = normalizeSortableValue(b[columnKey]);
			return (
				direction * left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
			);
		});
	}

	$: {
		const baseData = [...data];
		if (sortedColumn) {
			sortRowsInPlace(baseData, sortedColumn, sortOrder);
		}
		sortedData.set(baseData);
	}

	$: {
		const labeledIndex = headers.findIndex((header) => Boolean(header.label));
		titleHeaderIndex = labeledIndex >= 0 ? labeledIndex : 0;
	}

	function sortTable(columnKey: string) {
		if (sortedColumn === columnKey) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			sortedColumn = columnKey;
			sortOrder = 'asc';
		}
		dispatch('sortChange', { column: columnKey, order: sortOrder });
	}
</script>

<!-- Desktop Table -->
<div class="border-gray overflow-x-auto sm:rounded-sm lg:border lg:shadow-md">
	<table
		class={`hidden w-full lg:table ${sideScrollable ? 'min-w-max table-auto' : 'table-fixed'}`}
	>
		<thead class="bg-gray rounded-t-lg text-left text-white">
			<tr>
				{#if !noSelect}
					<th class="w-12 p-2 py-4 pl-4">
						<input type="checkbox" class="border-gray h-5 w-5 rounded-sm" />
					</th>
				{/if}

				{#each headers as header}
					<th
						class="{header.sort ? 'cursor-pointer' : ''} items-center gap-2 p-2 py-4 text-nowrap"
						on:click={() => header.sort && sortTable(header.key)}
						style={header.width ? `width: ${header.width}` : ''}
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
		<tbody class="divide-gray-bright divide-y bg-white">
			{#each $sortedData as row}
				<tr class="hover:bg-gray-100">
					{#if !noSelect}
						<td class="p-4">
							<input type="checkbox" class="border-gray h-5 w-5 rounded-sm" />
						</td>
					{/if}
					{#each headers as header}
						<td class="p-4" style={header.width ? `width: ${header.width}` : ''}>
							{#if Array.isArray(row[header.key])}
								<div
									class="flex flex-row flex-wrap gap-2 {header.key === 'actions' &&
										'justify-center'}"
								>
									{#each row[header.key] as item}
										{#if item.type === 'button'}
											{#if item.tooltip}
												<span use:tooltip={{ content: item.tooltip }} class="inline-flex">
													{#if item.confirmOptions}
														<Button
															confirmOptions={item.confirmOptions}
															text={item.label}
															iconLeft={item.label ? item.icon : undefined}
															iconLeftSize="14px"
															variant={item.variant}
															icon={item.label ? undefined : item.icon}
															disabled={Boolean(item.disabled)}
														/>
													{:else}
														<Button
															on:click={item.action}
															text={item.label}
															iconLeft={item.label ? item.icon : undefined}
															iconLeftSize="14px"
															variant={item.variant}
															icon={item.label ? undefined : item.icon}
															disabled={Boolean(item.disabled)}
														/>
													{/if}
												</span>
											{:else}
												{#if item.confirmOptions}
													<Button
														confirmOptions={item.confirmOptions}
														text={item.label}
														iconLeft={item.label ? item.icon : undefined}
														iconLeftSize="14px"
														variant={item.variant}
														icon={item.label ? undefined : item.icon}
														disabled={Boolean(item.disabled)}
													/>
												{:else}
													<Button
														on:click={item.action}
														text={item.label}
														iconLeft={item.label ? item.icon : undefined}
														iconLeftSize="14px"
														variant={item.variant}
														icon={item.label ? undefined : item.icon}
														disabled={Boolean(item.disabled)}
													/>
												{/if}
											{/if}
										{:else if item.type === 'link'}
											<button
												type="button"
												on:click={item.action}
												class="text-orange font-medium hover:underline"
											>
												{item.label}
											</button>
										{:else if item.type === 'status'}
											<span
												class="inline-flex items-center"
												title={item.label ?? ''}
											>
												<span
													class={`h-3 w-3 rounded-full ${
														item.status === 'inactive'
															? 'border border-yellow-500'
															: 'bg-green-500'
													}`}
												></span>
												{#if item.label}
													<span class="sr-only">{item.label}</span>
												{/if}
											</span>
										{:else}
											<p class="text-gray-700">{item.content}</p>
										{/if}
									{/each}
								</div>
							{:else}
								{formatCellDisplay(row[header.key])}
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
			<div class="border-gray rounded-sm border p-4 shadow-md">
				<div class="flex items-center justify-between">
					{#if Array.isArray(row[headers[titleHeaderIndex].key])}
						<div class="flex flex-col gap-1">
							{#each row[headers[titleHeaderIndex].key] as item}
								{#if item.type === 'link'}
									<button
										type="button"
										on:click={item.action}
										class="text-orange text-lg font-semibold hover:underline"
									>
										{item.label}
									</button>
								{:else}
									<h3 class="text-lg font-semibold">{formatCellDisplay(item)}</h3>
								{/if}
							{/each}
						</div>
					{:else}
						<h3 class="text-lg font-semibold">
							{formatCellDisplay(row[headers[titleHeaderIndex].key])}
						</h3>
					{/if}
					{#if !noSelect}
						<input type="checkbox" class="border-gray h-5 w-5 rounded-sm" />
					{/if}
				</div>
				{#each headers as header, i}
					{#if i !== titleHeaderIndex}
						<!-- Skip the title column since it's shown as heading -->
						<div class="mt-2">
							<p class="text-sm text-gray-600"><strong>{header.label}:</strong></p>
							{#if Array.isArray(row[header.key])}
								<div class="flex flex-row flex-wrap gap-2">
									{#each row[header.key] as item}
										{#if item.type === 'button'}
											{#if item.tooltip}
												<span use:tooltip={{ content: item.tooltip }} class="inline-flex">
													{#if item.confirmOptions}
														<Button
															confirmOptions={item.confirmOptions}
															text={item.label}
															iconLeft={item.label ? item.icon : undefined}
															iconLeftSize="14px"
															variant={item.variant}
															icon={item.label ? undefined : item.icon}
															disabled={Boolean(item.disabled)}
														/>
													{:else}
														<Button
															on:click={item.action}
															text={item.label}
															iconLeft={item.label ? item.icon : undefined}
															iconLeftSize="14px"
															variant={item.variant}
															icon={item.label ? undefined : item.icon}
															disabled={Boolean(item.disabled)}
														/>
													{/if}
												</span>
											{:else}
												{#if item.confirmOptions}
													<Button
														confirmOptions={item.confirmOptions}
														text={item.label}
														iconLeft={item.label ? item.icon : undefined}
														iconLeftSize="14px"
														variant={item.variant}
														icon={item.label ? undefined : item.icon}
														disabled={Boolean(item.disabled)}
													/>
												{:else}
													<Button
														on:click={item.action}
														text={item.label}
														iconLeft={item.label ? item.icon : undefined}
														iconLeftSize="14px"
														variant={item.variant}
														icon={item.label ? undefined : item.icon}
														disabled={Boolean(item.disabled)}
													/>
												{/if}
											{/if}
										{:else if item.type === 'link'}
											<button
												type="button"
												on:click={item.action}
												class="text-orange font-medium hover:underline"
											>
												{item.label}
											</button>
										{:else if item.type === 'status'}
											<span
												class="inline-flex items-center"
												title={item.label ?? ''}
											>
												<span
													class={`h-3 w-3 rounded-full ${
														item.status === 'inactive'
															? 'border border-yellow-500'
															: 'bg-green-500'
													}`}
												></span>
												{#if item.label}
													<span class="sr-only">{item.label}</span>
												{/if}
											</span>
										{:else}
											<p class="text-gray-700">{item.content}</p>
										{/if}
									{/each}
								</div>
							{:else}
								<p class="text-gray-700">{formatCellDisplay(row[header.key])}</p>
							{/if}
						</div>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
</div>
