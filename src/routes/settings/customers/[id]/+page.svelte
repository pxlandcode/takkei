<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { loadingStore } from '$lib/stores/loading';
	import Icon from '../../../../components/bits/icon-component/Icon.svelte';
	import Navigation from '../../../../components/bits/navigation/Navigation.svelte';
	import ProfileCustomerInfo from '../../../../components/ui/ProfileCustomerInfo/ProfileCustomerInfo.svelte';
	import ProfileBookingComponent from '../../../../components/ui/profileBookingComponent/ProfileBookingComponent.svelte';
	import ProfileNotesComponent from '../../../../components/ui/profileNotesComponent/ProfileNotesComponent.svelte';
	import MailComponent from '../../../../components/ui/mailComponent/MailComponent.svelte';
	import Button from '../../../../components/bits/button/Button.svelte';
	import { openPopup } from '$lib/stores/popupStore';
	import ProfileLifecycleManager from '../../../../components/ui/ProfileLifecycleManager.svelte';

	let customerId: number;
	let customer: any = null;
	let isLoading = true;
	let selectedTabProps: any = null;
	let canRenderSelectedTab = false;
	let isAwaitingTabData = false;
	let hasMounted = false;
	let requestedCustomerId: number | null = null;

	$: customerId = Number($page.params.id);
	$: isDeleted = Boolean(customer?.gdpr_deleted_at);

	function handleCustomerChange(updatedCustomer: any) {
		customer = updatedCustomer;
	}

	function getCustomerClientIds(): number[] {
		if (!Array.isArray(customer?.clients)) return [];
		const ids: number[] = customer.clients
			.map((client: { id?: number | string | null }) => Number(client?.id))
			.filter((id: number) => Number.isInteger(id) && id > 0);

		return [...new Set(ids)].sort((a, b) => a - b);
	}

	async function loadCustomerProfile(id: number) {
		if (!Number.isFinite(id) || id <= 0) {
			requestedCustomerId = null;
			customer = null;
			isLoading = false;
			return;
		}

		requestedCustomerId = id;
		isLoading = true;
		customer = null;
		loadingStore.loading(true, 'Hämtar kund...');
		try {
			const res = await fetch(`/api/customers/${id}`);
			if (!res.ok) throw new Error('Failed to fetch customer');
			const payload = await res.json();
			if (requestedCustomerId === id) {
				customer = payload;
			}
		} catch (error) {
			console.error('Error loading customer:', error);
		} finally {
			if (requestedCustomerId === id) {
				loadingStore.loading(false);
				isLoading = false;
			}
		}
	}

	async function loadCustomer() {
		await loadCustomerProfile(customerId);
	}

	const menuItems = [
		{
			label: 'Profil',
			icon: 'Customer',
			component: ProfileCustomerInfo,
			props: () =>
				customer
					? {
							customer,
							onCustomerChange: handleCustomerChange,
							refreshCustomer: loadCustomer,
							allowEditing: !isDeleted,
							allowManagement: !isDeleted
						}
					: {}
		},
		{
			label: 'Bokningar',
			icon: 'Calendar',
			component: ProfileBookingComponent,
			props: () => (customer ? { clientIds: getCustomerClientIds() } : {})
		},
		{
			label: 'Anteckningar',
			icon: 'Notes',
			component: ProfileNotesComponent,
			props: () =>
				customerId ? { targetId: customerId, targetType: 'Customer', readOnly: isDeleted } : {}
		},
		{
			label: 'Hantering',
			icon: 'Trash',
			component: ProfileLifecycleManager,
			requiredRoles: ['Administrator'],
			props: () =>
				customerId && customer
					? {
							entity: 'customer',
							entityId: customerId,
							displayName: customer.name ?? '',
							isDeleted,
							onDeleted: handleLifecycleDeleted,
							onMerged: handleLifecycleMerged
						}
					: {}
		}
	];

	const defaultTab = menuItems.find((item) => item.label === 'Profil') ?? menuItems[0];
	let selectedTab = defaultTab;

	$: if (!selectedTab && defaultTab) {
		selectedTab = defaultTab;
	}

	$: if (
		hasMounted &&
		Number.isFinite(customerId) &&
		customerId > 0 &&
		customerId !== requestedCustomerId
	) {
		selectedTab = defaultTab;
		void loadCustomerProfile(customerId);
	}

	$: {
		// ensure reactivity when customer data changes
		customer;
		customerId;
		const props = selectedTab?.props ? selectedTab.props() : null;
		selectedTabProps = props;
		isAwaitingTabData =
			Boolean(selectedTab?.component) &&
			Boolean(selectedTab?.props) &&
			(!props || Object.keys(props).length === 0);
		canRenderSelectedTab = Boolean(selectedTab?.component) && !isAwaitingTabData;
	}

	function openMailPopup() {
		if (!customer || isDeleted) return;
		const recipients = customer.email ? [customer.email] : [];
		openPopup({
			header: `Maila ${customer.name ?? ''}`.trim(),
			icon: 'Mail',
			component: MailComponent,
			maxWidth: '900px',
			props: {
				prefilledRecipients: recipients,
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			}
		});
	}

	onMount(() => {
		hasMounted = true;
		void loadCustomer();
	});

	function handleLifecycleDeleted(event: CustomEvent<any>) {
		const result = event.detail;
		if (!result?.hardDeleted) void loadCustomer();
	}

	function handleLifecycleMerged(_event: CustomEvent<any>) {}
</script>

<div class="m-4 flex flex-wrap items-center justify-between gap-2">
	<div class="flex items-center gap-2">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Customer" size="18px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">
			{customer ? customer.name : 'Laddar kund...'}
		</h2>
	</div>

	<div class="mr-14 flex space-x-2 md:mr-0">
		<Button
			icon="Mail"
			variant="secondary"
			disabled={isDeleted || !customer?.email}
			on:click={openMailPopup}
		/>
	</div>
</div>

<Navigation {menuItems} bind:selectedTab>
	{#if isLoading || isAwaitingTabData}
		<p class="text-gray-500">Laddar innehåll...</p>
	{:else if canRenderSelectedTab}
		<svelte:component this={selectedTab.component} {...selectedTabProps ?? {}} />
	{:else}
		<p class="text-gray-500">Innehåll kommer snart.</p>
	{/if}
</Navigation>
