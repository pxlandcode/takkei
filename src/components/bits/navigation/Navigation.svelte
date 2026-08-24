<script lang="ts">
	import Icon from '../icon-component/Icon.svelte';
	import IconArrowDown from '$lib/icons/IconArrowDown.svelte';
	import { tooltip } from '$lib/actions/tooltip';
	import { user } from '$lib/stores/userStore';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';

	type BaseMenuItem = {
		label: string;
		icon: string;
		requiredRoles?: string | string[];
		[key: string]: any;
	};

	type LeafMenuItem = BaseMenuItem & {
		children?: undefined;
	};

	type GroupMenuItem = BaseMenuItem & {
		children: MenuItem[];
		defaultOpen?: boolean;
	};

	type MenuItem = LeafMenuItem | GroupMenuItem;

	type NavigationRow =
		| {
				type: 'group';
				item: GroupMenuItem;
				key: string;
				depth: number;
		  }
		| {
				type: 'leaf';
				item: LeafMenuItem;
				key: string;
				depth: number;
		  };

	export let menuItems: MenuItem[] = [];
	export let selectedTab: LeafMenuItem | undefined;

	let visibleMenuItems: MenuItem[] = [];
	let visibleNavigationRows: NavigationRow[] = [];
	let hasGroupedItems = false;
	let openGroups: Record<string, boolean> = {};
	let lastAutoOpenedSelectedLabel: string | undefined;

	function isGroupItem(item: MenuItem): item is GroupMenuItem {
		return Array.isArray(item.children);
	}

	function canSeeItem(item: MenuItem) {
		return !item.requiredRoles || hasRole(item.requiredRoles, $user as any);
	}

	function getItemKey(item: MenuItem, parentKey = '') {
		return `${parentKey}/${item.label}`;
	}

	function filterVisibleItems(items: MenuItem[]): MenuItem[] {
		return items.reduce<MenuItem[]>((visibleItems, item) => {
			if (!canSeeItem(item)) return visibleItems;

			if (isGroupItem(item)) {
				const visibleChildren = filterVisibleItems(item.children);
				if (visibleChildren.length > 0) {
					visibleItems.push({ ...item, children: visibleChildren });
				}
				return visibleItems;
			}

			visibleItems.push(item);
			return visibleItems;
		}, []);
	}

	function getVisibleLeafItems(items: MenuItem[]): LeafMenuItem[] {
		return items.flatMap((item) => {
			if (isGroupItem(item)) return getVisibleLeafItems(item.children);
			return [item];
		});
	}

	function ensureSelectedTabIsVisible() {
		const visibleLeaves = getVisibleLeafItems(visibleMenuItems);

		if (visibleLeaves.length === 0) {
			selectedTab = undefined;
			return;
		}

		if (selectedTab && visibleLeaves.some((item) => item.label === selectedTab?.label)) return;
		selectedTab = visibleLeaves[0];
	}

	function applyDefaultOpenGroups(items: MenuItem[], parentKey = '') {
		const nextOpenGroups = { ...openGroups };
		let changed = false;

		function walk(walkItems: MenuItem[], currentParentKey = '') {
			walkItems.forEach((item) => {
				if (!isGroupItem(item)) return;

				const groupKey = getItemKey(item, currentParentKey);
				if (item.defaultOpen && nextOpenGroups[groupKey] === undefined) {
					nextOpenGroups[groupKey] = true;
					changed = true;
				}
				walk(item.children, groupKey);
			});
		}

		walk(items, parentKey);

		if (changed) {
			openGroups = nextOpenGroups;
		}
	}

	function openSelectedGroups(items: MenuItem[], parentKey = '') {
		if (!selectedTab) return;

		const nextOpenGroups = { ...openGroups };
		let changed = false;

		function walk(walkItems: MenuItem[], currentParentKey = ''): boolean {
			let selectedIsInside = false;

			walkItems.forEach((item) => {
				if (isGroupItem(item)) {
					const groupKey = getItemKey(item, currentParentKey);
					const selectedIsInsideGroup = walk(item.children, groupKey);

					if (selectedIsInsideGroup && nextOpenGroups[groupKey] !== true) {
						nextOpenGroups[groupKey] = true;
						changed = true;
					}

					selectedIsInside = selectedIsInside || selectedIsInsideGroup;
					return;
				}

				selectedIsInside = selectedIsInside || item.label === selectedTab?.label;
			});

			return selectedIsInside;
		}

		walk(items, parentKey);

		if (changed) {
			openGroups = nextOpenGroups;
		}
	}

	function createNavigationRows(items: MenuItem[], parentKey = '', depth = 0): NavigationRow[] {
		return items.flatMap<NavigationRow>((item) => {
			const itemKey = getItemKey(item, parentKey);

			if (!isGroupItem(item)) {
				return [{ type: 'leaf', item, key: itemKey, depth }];
			}

			const groupRows: NavigationRow[] = [{ type: 'group', item, key: itemKey, depth }];
			if (openGroups[itemKey]) {
				groupRows.push(...createNavigationRows(item.children, itemKey, depth + 1));
			}
			return groupRows;
		});
	}

	function toggleGroup(groupKey: string) {
		openGroups = {
			...openGroups,
			[groupKey]: !openGroups[groupKey]
		};
	}

	$: {
		$user;
		visibleMenuItems = filterVisibleItems(menuItems);
		hasGroupedItems = visibleMenuItems.some(isGroupItem);
		ensureSelectedTabIsVisible();
		applyDefaultOpenGroups(visibleMenuItems);

		if (selectedTab?.label !== lastAutoOpenedSelectedLabel) {
			openSelectedGroups(visibleMenuItems);
			lastAutoOpenedSelectedLabel = selectedTab?.label;
		}
	}

	$: {
		openGroups;
		visibleNavigationRows = createNavigationRows(visibleMenuItems);
	}

	function selectTab(item: LeafMenuItem) {
		selectedTab = item;
	}
</script>

<!-- 🔹 Navigation Layout -->
<div class="flex min-h-0 flex-1 overflow-hidden border-t">
	<!-- 🔹 Sidebar Nav (Desktop) -->
	<aside
		class="custom-scrollbar hidden min-h-0 w-52 shrink-0 overflow-y-auto border-r p-6 lg:block"
	>
		<ul class="space-y-2 text-gray-600">
			{#each visibleNavigationRows as row (row.key)}
				<li>
					{#if row.type === 'group'}
						<button
							type="button"
							class="hover:text-orange flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm py-2 pr-2 text-left underline-offset-4 hover:underline"
							style:padding-left={`${8 + row.depth * 16}px`}
							on:click={() => toggleGroup(row.key)}
							use:tooltip={{ content: row.item.label, preferred: 'right', delay: 200 }}
							aria-expanded={Boolean(openGroups[row.key])}
						>
							<span class="flex min-w-0 items-center gap-2">
								<Icon icon={row.item.icon} size="18px" />
								<span class="truncate">{row.item.label}</span>
							</span>
							<IconArrowDown
								size="12px"
								extraClasses={`shrink-0 transform transition-all duration-300 ${openGroups[row.key] ? 'rotate-180 text-orange' : 'text-gray'}`}
							/>
						</button>
					{:else}
						<button
							type="button"
							class="hover:text-orange flex w-full cursor-pointer items-center gap-2 rounded-sm py-2 pr-2 text-left underline-offset-4 hover:underline"
							style:padding-left={`${8 + row.depth * 16}px`}
							class:font-semibold={selectedTab?.label === row.item.label}
							class:text-orange={selectedTab?.label === row.item.label}
							on:click={() => selectTab(row.item)}
							use:tooltip={{ content: row.item.label, preferred: 'right', delay: 200 }}
						>
							<Icon icon={row.item.icon} size="18px" />
							<span class="truncate">{row.item.label}</span>
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	</aside>

	<!-- 🔹 Main Content with Mobile Nav -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- 🔹 Mobile Nav (Top) -->
		{#if hasGroupedItems}
			<nav class="w-full shrink-0 border-b p-4 lg:hidden">
				<ul class="space-y-1 text-gray-600">
					{#each visibleNavigationRows as row (row.key)}
						<li>
							{#if row.type === 'group'}
								<button
									type="button"
									on:click={() => toggleGroup(row.key)}
									class="hover:text-orange flex w-full items-center justify-between gap-2 rounded-sm py-2 pr-2 hover:bg-gray-200"
									style:padding-left={`${8 + row.depth * 16}px`}
									use:tooltip={{ content: row.item.label, preferred: 'bottom', delay: 200 }}
									aria-expanded={Boolean(openGroups[row.key])}
								>
									<span class="flex min-w-0 items-center gap-2">
										<Icon icon={row.item.icon} size="18px" />
										<span class="truncate">{row.item.label}</span>
									</span>
									<IconArrowDown
										size="12px"
										extraClasses={`shrink-0 transform transition-all duration-300 ${openGroups[row.key] ? 'rotate-180 text-orange' : 'text-gray'}`}
									/>
								</button>
							{:else}
								<button
									type="button"
									on:click={() => selectTab(row.item)}
									class="hover:text-orange flex w-full items-center gap-2 rounded-sm py-2 pr-2 text-left hover:bg-gray-200"
									style:padding-left={`${8 + row.depth * 16}px`}
									class:text-gray-600={selectedTab?.label !== row.item.label}
									class:text-orange={selectedTab?.label === row.item.label}
									class:font-semibold={selectedTab?.label === row.item.label}
									use:tooltip={{ content: row.item.label, preferred: 'bottom', delay: 200 }}
								>
									<Icon icon={row.item.icon} size="18px" />
									<span class="truncate">{row.item.label}</span>
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			</nav>
		{:else}
			<nav class="flex w-full shrink-0 flex-wrap justify-around border-b p-4 lg:hidden">
				{#each visibleMenuItems as item}
					{#if !isGroupItem(item)}
						<button
							type="button"
							on:click={() => selectTab(item)}
							class="hover:text-orange flex items-center gap-2 rounded-sm p-2 hover:bg-gray-200"
							class:text-gray-600={selectedTab?.label !== item.label}
							class:text-orange={selectedTab?.label === item.label}
							class:font-semibold={selectedTab?.label === item.label}
							use:tooltip={{ content: item.label, preferred: 'bottom', delay: 200 }}
						>
							<Icon icon={item.icon} size="18px" />
							{item.label}
						</button>
					{/if}
				{/each}
			</nav>
		{/if}

		<!-- 🔹 Slot for dynamic content -->
		<div class="custom-scrollbar flex-1 overflow-auto p-6">
			<slot />
		</div>
	</div>
</div>
