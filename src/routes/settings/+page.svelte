<script>
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import CustomerSettings from '../../components/ui/customerSettings/CustomerSettings.svelte';
	import LocationSettings from '../../components/ui/locationSettings/LocationSettings.svelte';
	import PackagesSettings from '../../components/ui/packagesSettings/PackagesSettings.svelte';
	import TargetsSettings from '../../components/ui/targetsSettings/TargetsSettings.svelte';
	import SchedulingSettings from '../../components/ui/schedulingSettings/SchedulingSettings.svelte';
	import ObSettings from '../../components/ui/obSettings/ObSettings.svelte';
	import HolidaySettings from '../../components/ui/holidaySettings/HolidaySettings.svelte';
	import MailComponent from '../../components/ui/mailComponent/MailComponent.svelte';
	import Navigation from '../../components/bits/navigation/Navigation.svelte';
	import UserForm from '../../components/ui/userForm/UserForm.svelte';
	import Button from '../../components/bits/button/Button.svelte';

	import NotificationAdministration from '../../components/ui/notificationAdministration/NotificationAdministration.svelte';
	import MailHistory from '../../components/ui/mailHistory/MailHistory.svelte';

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
		{ label: 'Mailhistorik', icon: 'HistoryList', component: MailHistory },
		{
			label: 'Notifikationer',
			icon: 'Notification',
			component: NotificationAdministration,
			requiredRoles: ['Administrator', 'LocationAdmin']
		},
		{
			label: 'Mål',
			icon: 'Trophy',
			component: TargetsSettings,
			requiredRoles: ['Administrator']
		},
		{
			label: 'Schema',
			icon: 'Calendar',
			component: SchedulingSettings,
			requiredRoles: ['Administrator']
		},
		{
			label: 'OB-fönster',
			icon: 'Clock',
			component: ObSettings,
			requiredRoles: ['Administrator']
		},
		{
			label: 'Helgdagar',
			icon: 'CalendarSun',
			component: HolidaySettings,
			requiredRoles: ['Administrator']
		}
	];

	import { onMount } from 'svelte';
	import { headerState } from '$lib/stores/headerState.svelte';

	let selectedTab = menuItems[0];

	async function logout() {
		await fetch('/api/logout', { method: 'POST' });
		window.location.href = '/login';
	}

	onMount(() => {
		headerState.title = 'Inställningar';
		headerState.icon = 'Settings';
	});
</script>

<div class="m-4 ml-3 flex flex-wrap items-center justify-between">
	<div class="hidden shrink-0 items-center gap-2 md:flex">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Settings" size="18px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">Inställningar</h2>
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
