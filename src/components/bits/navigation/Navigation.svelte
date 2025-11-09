<script lang="ts">
	import Icon from '../icon-component/Icon.svelte';
	import { user } from '$lib/stores/userStore';
	import { get } from 'svelte/store';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';

	export let menuItems = [];
	export let selectedTab;

	const currentUser = get(user);
	const userRoles = currentUser?.roles?.map((r) => r.name) || [];

	$: visibleMenuItems = menuItems.filter((item) => {
		return !item.requiredRoles || hasRole(item.requiredRoles);
	});

	function selectTab(item) {
		selectedTab = item;
	}
</script>

<!-- 🔹 Navigation Layout -->
<div class="flex flex-1 overflow-hidden border-t">
	<!-- 🔹 Sidebar Nav (Desktop) -->
	<aside class="hidden w-52 shrink-0 border-r p-6 lg:block">
		<ul class="space-y-2 text-gray-600">
			{#each visibleMenuItems as item}
				<li
					class="flex cursor-pointer items-center gap-2 rounded-sm p-2 underline-offset-4 hover:text-orange hover:underline {selectedTab.label ===
						item.label && 'selected'}"
					on:click={() => selectTab(item)}
				>
					<Icon icon={item.icon} size="18px" />
					{item.label}
				</li>
			{/each}
		</ul>
	</aside>

	<!-- 🔹 Main Content with Mobile Nav -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- 🔹 Mobile Nav (Top) -->
		<nav class="flex w-full shrink-0 flex-wrap justify-around border-b p-4 lg:hidden">
			{#each visibleMenuItems as item}
				<button
					on:click={() => selectTab(item)}
					class="tab-button {selectedTab.label === item.label && 'selected'}"
				>
					<Icon icon={item.icon} size="18px" />
					{item.label}
				</button>
			{/each}
		</nav>

		<!-- 🔹 Slot for dynamic content -->
		<div class="flex-1 overflow-auto p-6 custom-scrollbar">
			<slot />
		</div>
	</div>
</div>

<style>
	.tab-button {
		@apply flex items-center gap-2 rounded-sm p-2 text-gray-600 hover:text-orange;
	}
	.selected {
		@apply font-semibold text-orange;
	}
</style>
