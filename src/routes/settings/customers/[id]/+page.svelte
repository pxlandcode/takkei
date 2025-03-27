<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { loadingStore } from '$lib/stores/loading';
	import Icon from '../../../../components/bits/icon-component/Icon.svelte';
	import ProfileCustomerInfo from '../../../../components/ui/ProfileCustomerInfo/ProfileCustomerInfo.svelte';

	let customerId: number;
	let customer: any = null;
	let selectedTab = 'Profil';

	$: customerId = Number($page.params.id);

	onMount(async () => {
		if (!customerId) return;
		loadingStore.loading(true, 'Hämtar kund...');
		try {
			const res = await fetch(`/api/customers/${customerId}`);
			if (!res.ok) throw new Error('Failed to fetch customer');
			customer = await res.json();

			console.log('customer', customer);
		} catch (error) {
			console.error('Error loading customer:', error);
			loadingStore.loading(false);
		} finally {
			loadingStore.loading(false);
		}
	});
</script>

<div class=" custom-scrollbar">
	<!-- 🧾 Title -->
	<div class=" m-4 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
				<Icon icon="Customer" size="18px" />
			</div>
			<h2 class="text-3xl font-semibold text-text">
				{customer ? customer.name : 'Laddar kund...'}
			</h2>
		</div>
	</div>

	<!-- 🔹 Top Nav (Mobile) -->
	<nav class="flex w-full justify-around border-b p-4 2xl:hidden">
		{#each ['Profil', 'Bokningar', 'Anteckningar'] as tab}
			<button
				on:click={() => (selectedTab = tab)}
				class="tab-button {selectedTab === tab && 'selected'}"
			>
				<Icon
					icon={tab === 'Profil' ? 'Clients' : tab === 'Bokningar' ? 'Calendar' : 'Notes'}
					size="18px"
				/>
				{tab}
			</button>
		{/each}
	</nav>

	<div class="flex border-t">
		<!-- 🔹 Sidebar (Desktop) -->
		<aside class="hidden w-64 border-r p-6 2xl:block">
			<ul class="space-y-2 text-gray-600">
				{#each ['Profil', 'Bokningar', 'Anteckningar'] as tab}
					<li
						class="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-200 {selectedTab ===
							tab && 'selected'}"
						on:click={() => (selectedTab = tab)}
					>
						<Icon
							icon={tab === 'Profil' ? 'Organization' : tab === 'Bokningar' ? 'Calendar' : 'Notes'}
							size="18px"
						/>
						{tab}
					</li>
				{/each}
			</ul>
		</aside>

		<!-- 🔹 Main Content -->
		<div class="flex-1 p-6">
			{#if selectedTab === 'Profil'}
				{#if customer}
					<ProfileCustomerInfo {customer} />
				{:else}
					<p class="text-gray-500">Laddar profil...</p>
				{/if}
			{:else if selectedTab === 'Bokningar'}
				<p class="text-gray-500">Komponent för kundbokningar kommer här.</p>
			{:else if selectedTab === 'Anteckningar'}
				<!-- <ProfileNotesComponent targetId={customerId} /> -->
			{/if}
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
