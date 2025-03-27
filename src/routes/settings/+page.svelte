<script>
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import CustomerSettings from '../../components/ui/customerSettings/CustomerSettings.svelte';
	import LocationSettings from '../../components/ui/locationSettings/LocationSettings.svelte';

	// Import your actual content components

	const menuItems = [
		{ label: 'Allmänt', icon: 'Settings', component: Icon },
		{ label: 'Användare', icon: 'Person', component: Icon },
		{ label: 'Notifikationer', icon: 'Notification', component: Icon },
		{ label: 'Kunder', icon: 'Customer', component: CustomerSettings },
		{ label: 'Lokaler', icon: 'Building', component: LocationSettings }
	];

	let selectedTab = menuItems[0];
</script>

<div class="flex flex-1 flex-col overflow-hidden">
	<!-- Page Title -->
	<div class="m-4 ml-3 flex shrink-0 items-center justify-between">
		<div class="flex flex-row items-center gap-2">
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
				<Icon icon="Settings" size="18px" />
			</div>
			<h2 class="text-3xl font-semibold text-text">Inställningar</h2>
		</div>
	</div>

	<!-- 🔹 Top Navigation (Visible on small screens) -->
	<nav class="flex w-full shrink-0 justify-around border-b p-4 lg:hidden">
		{#each menuItems as item}
			<button
				on:click={() => (selectedTab = item)}
				class="tab-button {selectedTab.label === item.label && 'selected'}"
			>
				<Icon icon={item.icon} size="18px" />
				{item.label}
			</button>
		{/each}
	</nav>

	<!-- 🔹 Main Layout -->
	<div class="flex flex-1 overflow-hidden border-t">
		<!-- 🔹 Sidebar Navigation (Hidden on small screens) -->
		<aside class="hidden w-64 shrink-0 border-r p-6 lg:block">
			<ul class="space-y-2 text-gray-600">
				{#each menuItems as item}
					<li
						class="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-200 {selectedTab.label ===
							item.label && 'selected'}"
						on:click={() => (selectedTab = item)}
					>
						<Icon icon={item.icon} size="18px" />
						{item.label}
					</li>
				{/each}
			</ul>
		</aside>

		<!-- 🔹 Main Content -->
		<div class="flex-1 overflow-auto p-6 custom-scrollbar">
			<svelte:component this={selectedTab.component} />
		</div>
	</div>
</div>

<style>
	.tab-button {
		@apply flex items-center gap-2 rounded-md p-2 text-gray-600 hover:bg-gray-200;
	}
	.selected {
		@apply bg-gray-200 font-semibold;
	}
</style>
