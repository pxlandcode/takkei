<script lang="ts">
	import Icon from '../icon-component/Icon.svelte';

	export let menuItems = [];
	export let selectedTab;
	export let title = 'Inställningar';

	function selectTab(item) {
		selectedTab = item;
	}
</script>

<!-- Outer wrapper -->
<div class="flex flex-1 flex-col overflow-hidden">
	<!-- 🔹 Title + Mobile Nav -->
	<div class="m-4 ml-3 flex shrink-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
		<div class="flex flex-row items-center gap-2">
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
				<Icon icon="Settings" size="18px" />
			</div>
			<h2 class="text-3xl font-semibold text-text">{title}</h2>
		</div>
	</div>

	<!-- 🔹 Mobile Nav -->
	<nav class="flex w-full shrink-0 flex-wrap justify-around border-b p-4 lg:hidden">
		{#each menuItems as item}
			<button
				on:click={() => selectTab(item)}
				class="tab-button {selectedTab.label === item.label && 'selected'}"
			>
				<Icon icon={item.icon} size="18px" />
				{item.label}
			</button>
		{/each}
	</nav>

	<!-- 🔹 Main Layout -->
	<div class="flex flex-1 overflow-hidden border-t">
		<!-- Sidebar -->
		<aside class="hidden w-52 shrink-0 border-r p-6 lg:block">
			<ul class="space-y-2 text-gray-600">
				{#each menuItems as item}
					<li
						class="flex cursor-pointer items-center gap-2 rounded-md p-2 underline-offset-4 hover:text-orange hover:underline {selectedTab.label ===
							item.label && 'selected'}"
						on:click={() => selectTab(item)}
					>
						<Icon icon={item.icon} size="18px" />
						{item.label}
					</li>
				{/each}
			</ul>
		</aside>

		<!-- Main Content via slot -->
		<div class="flex-1 overflow-auto p-6 custom-scrollbar">
			<slot />
		</div>
	</div>
</div>

<style>
	.tab-button {
		@apply flex items-center gap-2 rounded-md p-2 text-gray-600 hover:text-orange;
	}
	.selected {
		@apply font-semibold text-orange;
	}
</style>
