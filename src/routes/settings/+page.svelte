<script>
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import CustomerSettings from '../../components/ui/customerSettings/CustomerSettings.svelte';
	import LocationSettings from '../../components/ui/locationSettings/LocationSettings.svelte';
	import PackagesSettings from '../../components/ui/packagesSettings/PackagesSettings.svelte';
	import MailComponent from '../../components/ui/mailComponent/MailComponent.svelte';
	import Navigation from '../../components/bits/navigation/Navigation.svelte';
	import UserForm from '../../components/ui/userForm/UserForm.svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import { goto } from '$app/navigation';
	import NotificationCreator from '../../components/ui/notificationCreator/NotificationCreator.svelte';

	const menuItems = [
		{ label: 'Allmänt', icon: 'Settings', component: Icon },
		{
			label: 'Ny användare',
			icon: 'Person',
			component: UserForm,
			requiredRoles: ['Administrator']
		},
		{
			label: 'Kunder',
			icon: 'Customer',
			component: CustomerSettings
		},
		{
			label: 'Lokaler',
			icon: 'Building',
			component: LocationSettings,
			requiredRoles: ['Administrator']
		},
		{ label: 'Paket', icon: 'Package', component: PackagesSettings },
		{ label: 'Mailutskick', icon: 'Mail', component: MailComponent },
		{
			label: 'Skapa Notis',
			icon: 'Notification',
			component: NotificationCreator,
			requiredRoles: ['Administrator']
		}
	];

	let selectedTab = menuItems[0];

	async function logout() {
		await fetch('/api/logout', { method: 'POST' });
		window.location.href = '/login';
	}
</script>

<div class="m-4 ml-3 flex flex-wrap items-center justify-between">
	<div class="flex shrink-0 items-center gap-2">
		<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Settings" size="18px" />
		</div>
		<h2 class="text-3xl font-semibold text-text">Inställningar</h2>
	</div>

	<div class="mr-14 md:mr-0">
		<Button
			text="Logga ut"
			iconLeft="Logout"
			iconLeftSize="16"
			variant="secondary"
			small
			on:click={logout}
		/>
	</div>
</div>

<!-- Navigation with slot for content -->
<Navigation {menuItems} bind:selectedTab>
	<svelte:component this={selectedTab.component} />
</Navigation>

<style>
</style>
