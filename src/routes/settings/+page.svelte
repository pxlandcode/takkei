<script>
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import CustomerSettings from '../../components/ui/customerSettings/CustomerSettings.svelte';
	import LocationSettings from '../../components/ui/locationSettings/LocationSettings.svelte';
	import PackagesSettings from '../../components/ui/packagesSettings/PackagesSettings.svelte';
	import MailComponent from '../../components/ui/mailComponent/MailComponent.svelte';
	import Navigation from '../../components/bits/navigation/Navigation.svelte';

	// Import your actual content components

	const menuItems = [
		{ label: 'Allmänt', icon: 'Settings', component: Icon },
		{ label: 'Användare', icon: 'Person', component: Icon },
		{ label: 'Notifikationer', icon: 'Notification', component: Icon },
		{ label: 'Kunder', icon: 'Customer', component: CustomerSettings },
		{ label: 'Lokaler', icon: 'Building', component: LocationSettings },
		{ label: 'Paket', icon: 'Package', component: PackagesSettings },
		{ label: 'Mailutskick', icon: 'Mail', component: MailComponent }
	];

	let selectedTab = menuItems[0];
</script>

<div class="m-4 ml-3 flex shrink-0 items-center gap-2">
	<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
		<!-- Use your icon -->
		<Icon icon="Settings" size="18px" />
	</div>
	<h2 class="text-3xl font-semibold text-text">Inställningar</h2>
</div>

<!-- Navigation with slot for content -->
<Navigation {menuItems} bind:selectedTab>
	<svelte:component this={selectedTab.component} />
</Navigation>

<style>
	.tab-button {
		@apply flex items-center gap-2 rounded-md p-2 text-gray-600 hover:text-orange;
	}
	.selected {
		@apply font-semibold text-orange;
	}
</style>
