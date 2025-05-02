<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Icon from '../../../../components/bits/icon-component/Icon.svelte';
	import Button from '../../../../components/bits/button/Button.svelte';

	let packageId: number;
	let pkg = null;

	$: packageId = Number($page.params.id);

	const tabs = [
		{ label: 'Paket', icon: 'Package' },
		{ label: 'Bokningar', icon: 'Calendar' },
		{ label: 'Anteckningar', icon: 'Notes' }
	];
	let selectedTab = tabs[0].label;

	onMount(async () => {
		const res = await fetch(`/api/packages/${packageId}`);
		if (res.ok) {
			pkg = await res.json();
		}
	});
</script>

<div class="m-4 custom-scrollbar">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
				<Icon icon="Package" size="18px" />
			</div>
			<h2 class="text-3xl font-semibold text-text">{pkg?.article.name || 'Laddar...'}</h2>
		</div>

		<div class="flex gap-2">
			<Button text="Frys paket" icon="Snowflake" variant="secondary" />
			<Button text="Ändra" icon="Pen" variant="primary" />
		</div>
	</div>

	<!-- Mobile Tabs -->
	<nav class="flex w-full justify-around border-b p-4 lg:hidden">
		{#each tabs as tab}
			<button
				on:click={() => (selectedTab = tab.label)}
				class="tab-button {selectedTab === tab.label && 'selected'}"
			>
				<Icon icon={tab.icon} size="18px" />
				{tab.label}
			</button>
		{/each}
	</nav>

	<div class="flex border-t">
		<!-- Sidebar Tabs -->
		<aside class="hidden w-52 shrink-0 border-r p-6 lg:block">
			<ul class="space-y-2">
				{#each tabs as tab}
					<li
						on:click={() => (selectedTab = tab.label)}
						class="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-gray-100 {selectedTab ===
							tab.label && 'selected'}"
					>
						<Icon icon={tab.icon} size="18px" />
						{tab.label}
					</li>
				{/each}
			</ul>
		</aside>

		<!-- Main Content -->
		<div class="flex-1 p-6">
			{#if selectedTab === 'Paket' && pkg}
				<div class="space-y-2">
					<p><strong>Kund:</strong> {pkg.customer.name}</p>
					<p>
						<strong>Klient:</strong>
						{pkg.client ? `${pkg.client.firstname} ${pkg.client.lastname}` : '–'}
					</p>
					<p><strong>Produkt:</strong> {pkg.article.name} ({pkg.article.sessions} pass)</p>
					<p><strong>Pris:</strong> {pkg.paid_price} kr</p>
					<p><strong>Första fakturadatum:</strong> {pkg.first_payment_date}</p>
					<p><strong>Autogiro:</strong> {pkg.autogiro ? 'Ja' : 'Nej'}</p>
					<p><strong>Antal fakturor:</strong> {pkg.installments.length}</p>
					<ul>
						{#each pkg.installments as i}
							<li>{i.sum} kr ({i.date})</li>
						{/each}
					</ul>
				</div>
			{:else if selectedTab === 'Bokningar'}
				<p>Bokningar för detta paket visas här...</p>
			{:else if selectedTab === 'Anteckningar'}
				<p>Anteckningar visas här...</p>
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
