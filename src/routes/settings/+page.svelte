<script>
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import CustomerSettings from '../../components/ui/customerSettings/CustomerSettings.svelte';
	import LocationSettings from '../../components/ui/locationSettings/LocationSettings.svelte';
	import PackagesSettings from '../../components/ui/packagesSettings/PackagesSettings.svelte';
	import MailSettings from '../../components/ui/mailSettings/MailSettings.svelte';
	import Navigation from '../../components/bits/navigation/Navigation.svelte';

	// Import your actual content components

	const menuItems = [
		{ label: 'Allmänt', icon: 'Settings', component: Icon },
		{ label: 'Användare', icon: 'Person', component: Icon },
		{ label: 'Notifikationer', icon: 'Notification', component: Icon },
		{ label: 'Kunder', icon: 'Customer', component: CustomerSettings },
		{ label: 'Lokaler', icon: 'Building', component: LocationSettings },
		{ label: 'Paket', icon: 'Package', component: PackagesSettings },
		{ label: 'Mailutskick', icon: 'Mail', component: MailSettings }
	];

	let selectedTab = menuItems[0];
</script>

<Navigation {menuItems} bind:selectedTab title="Inställningar">
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
