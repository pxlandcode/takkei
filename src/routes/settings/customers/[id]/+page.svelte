<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { loadingStore } from '$lib/stores/loading';
	import Icon from '../../../../components/bits/icon-component/Icon.svelte';
	import Navigation from '../../../../components/bits/navigation/Navigation.svelte';
import ProfileCustomerInfo from '../../../../components/ui/ProfileCustomerInfo/ProfileCustomerInfo.svelte';
import ProfileNotesComponent from '../../../../components/ui/profileNotesComponent/ProfileNotesComponent.svelte';
import MailComponent from '../../../../components/ui/mailComponent/MailComponent.svelte';
import Button from '../../../../components/bits/button/Button.svelte';
import { openPopup } from '$lib/stores/popupStore';

	let customerId: number;
	let customer: any = null;

	$: customerId = Number($page.params.id);

	function handleCustomerChange(updatedCustomer: any) {
		customer = updatedCustomer;
	}

const menuItems = [
	{
		label: 'Profil',
			icon: 'Customer',
			component: ProfileCustomerInfo,
			props: () => (customer ? { customer, onCustomerChange: handleCustomerChange } : {})
		},
		{
			label: 'Bokningar',
			icon: 'Calendar',
			component: null
		},
		{
			label: 'Anteckningar',
			icon: 'Notes',
			component: ProfileNotesComponent,
			props: () => (customerId ? { targetId: customerId } : {})
		}
	];

let selectedTab = menuItems[0];

function openMailPopup() {
	if (!customer) return;
	const recipients = customer.email ? [customer.email] : [];
	openPopup({
		header: `Maila ${customer.name ?? ''}`.trim(),
		icon: 'Mail',
		component: MailComponent,
		width: '900px',
		props: {
			prefilledRecipients: recipients,
			lockedFields: ['recipients'],
			autoFetchUsersAndClients: false
		}
	});
}

	onMount(async () => {
		if (!customerId) return;
		loadingStore.loading(true, 'Hämtar kund...');
		try {
			const res = await fetch(`/api/customers/${customerId}`);
			if (!res.ok) throw new Error('Failed to fetch customer');
			customer = await res.json();
		} catch (error) {
			console.error('Error loading customer:', error);
		} finally {
			loadingStore.loading(false);
		}
	});
</script>

<div class="m-4 flex flex-wrap items-center justify-between gap-2">
	<div class="flex items-center gap-2">
		<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Customer" size="18px" />
		</div>
		<h2 class="text-3xl font-semibold text-text">
			{customer ? customer.name : 'Laddar kund...'}
		</h2>
	</div>

	<div class="mr-14 flex space-x-2 md:mr-0">
	<Button icon="Mail" variant="secondary" on:click={openMailPopup} />
	</div>
</div>

<Navigation {menuItems} bind:selectedTab>
	{#if selectedTab.component && (!selectedTab.props || Object.keys(selectedTab.props()).length > 0)}
		<svelte:component this={selectedTab.component} {...selectedTab.props()} />
	{:else}
		<p class="text-gray-500">Innehåll kommer snart.</p>
	{/if}
</Navigation>
