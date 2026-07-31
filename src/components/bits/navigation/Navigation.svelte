<script lang="ts">
	import Icon from '../icon-component/Icon.svelte';
	import { user } from '$lib/stores/userStore';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';

	type MenuItem = {
		label: string;
		icon: string;
		requiredRoles?: string | string[];
		[key: string]: any;
	};

	export let menuItems: MenuItem[] = [];
	export let selectedTab: MenuItem | undefined;

	let visibleMenuItems: MenuItem[] = [];

	function ensureSelectedTabIsVisible() {
		if (!selectedTab) return;
		if (visibleMenuItems.some((item) => item.label === selectedTab?.label)) return;
		selectedTab = visibleMenuItems[0];
	}

	$: {
		visibleMenuItems = menuItems.filter((item) => {
			return !item.requiredRoles || hasRole(item.requiredRoles, $user as any);
		});
		ensureSelectedTabIsVisible();
	}

	function selectTab(item: MenuItem) {
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
			{#each visibleMenuItems as item}
				<li>
					<button
						type="button"
						class="hover:text-orange flex w-full cursor-pointer items-center gap-2 rounded-sm p-2 text-left underline-offset-4 hover:underline"
						class:font-semibold={selectedTab?.label === item.label}
						class:text-orange={selectedTab?.label === item.label}
						on:click={() => selectTab(item)}
					>
						<Icon icon={item.icon} size="18px" />
						{item.label}
					</button>
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
					type="button"
					on:click={() => selectTab(item)}
					class="hover:text-orange flex items-center gap-2 rounded-sm p-2 hover:bg-gray-200"
					class:text-gray-600={selectedTab?.label !== item.label}
					class:text-orange={selectedTab?.label === item.label}
					class:font-semibold={selectedTab?.label === item.label}
				>
					<Icon icon={item.icon} size="18px" />
					{item.label}
				</button>
			{/each}
		</nav>

		<!-- 🔹 Slot for dynamic content -->
		<div class="custom-scrollbar flex-1 overflow-auto p-6">
			<slot />
		</div>
	</div>
</div>
