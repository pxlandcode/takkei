<script>
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import CustomerSettings from '../../components/ui/customerSettings/CustomerSettings.svelte';
	import LocationSettings from '../../components/ui/locationSettings/LocationSettings.svelte';
	import PackagesSettings from '../../components/ui/packagesSettings/PackagesSettings.svelte';
	import ArticlesSettings from '../../components/ui/articlesSettings/ArticlesSettings.svelte';
	import TargetsSettings from '../../components/ui/targetsSettings/TargetsSettings.svelte';
	import SchedulingSettings from '../../components/ui/schedulingSettings/SchedulingSettings.svelte';
	import ObSettings from '../../components/ui/obSettings/ObSettings.svelte';
	import HolidaySettings from '../../components/ui/holidaySettings/HolidaySettings.svelte';
	import MailComponent from '../../components/ui/mailComponent/MailComponent.svelte';
	import Navigation from '../../components/bits/navigation/Navigation.svelte';
	import UserForm from '../../components/ui/userForm/UserForm.svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import EmailFooterSettings from '../../components/ui/emailFooterSettings/EmailFooterSettings.svelte';
	import GreetingSettings from '../../components/ui/greetingSettings/GreetingSettings.svelte';
	import HolidayPaySettings from '../../components/ui/holidayPaySettings/HolidayPaySettings.svelte';
	import CancellationReasonSettings from '../../components/ui/cancellationReasonSettings/CancellationReasonSettings.svelte';
	import PassTypeSettings from '../../components/ui/passTypeSettings/PassTypeSettings.svelte';
	import StandbySettings from '../../components/ui/standbySettings/StandbySettings.svelte';
	import AnonymizedProfilesSettings from '../../components/ui/anonymizedProfilesSettings/AnonymizedProfilesSettings.svelte';

	import NotificationAdministration from '../../components/ui/notificationAdministration/NotificationAdministration.svelte';
	import MailHistory from '../../components/ui/mailHistory/MailHistory.svelte';

	const menuItems = [
		{
			icon: 'Customer',
			label: 'Klienter och paket',
			children: [
				{
					label: 'Kunder',
					icon: 'Customer',
					component: CustomerSettings
				},
				{ label: 'Paket', icon: 'Package', component: PackagesSettings },
				{
					label: 'Anonymiserade',
					icon: 'EyeOff',
					component: AnonymizedProfilesSettings,
					requiredRoles: ['Administrator']
				}
			]
		},
		{
			icon: 'Building',
			label: 'Drift',
			children: [
				{
					label: 'Lokaler',
					icon: 'Building',
					component: LocationSettings,
					requiredRoles: ['Administrator']
				},
				{
					label: 'Ny användare',
					icon: 'Person',
					component: UserForm,
					requiredRoles: ['Administrator']
				},
				{
					label: 'Notifikationer',
					icon: 'Notification',
					component: NotificationAdministration,
					requiredRoles: ['Administrator', 'LocationAdmin']
				}
			]
		},
		{
			icon: 'Mail',
			label: 'Kommunikation',
			children: [
				{ label: 'Mailutskick', icon: 'Mail', component: MailComponent },
				{ label: 'Mailhistorik', icon: 'HistoryList', component: MailHistory },
				{
					label: 'Mailfot',
					icon: 'Mail',
					component: EmailFooterSettings,
					requiredRoles: ['Administrator']
				},
				{
					label: 'Hälsningar',
					icon: 'ShiningStar',
					component: GreetingSettings,
					requiredRoles: ['Administrator']
				}
			]
		},
		{
			icon: 'Calendar',
			label: 'Admin',
			children: [
				{ label: 'Standbytid', icon: 'Clock', component: StandbySettings },
				{
					label: 'Mål',
					icon: 'Trophy',
					component: TargetsSettings,
					requiredRoles: ['Administrator']
				},
				{
					label: 'Passtyper',
					icon: 'Training',
					component: PassTypeSettings,
					requiredRoles: ['Administrator']
				},
				{
					label: 'Avbokningsorsaker',
					icon: 'Cancel',
					component: CancellationReasonSettings,
					requiredRoles: ['Administrator']
				},
				{
					label: 'Schema',
					icon: 'Calendar',
					component: SchedulingSettings,
					requiredRoles: ['Administrator']
				},
				{
					label: 'Helgdagar',
					icon: 'CalendarSun',
					component: HolidaySettings,
					requiredRoles: ['Administrator']
				}
			]
		},
		{
			icon: 'Money',
			label: 'Ekonomi',
			children: [
				{
					label: 'Artiklar',
					icon: 'Package',
					component: ArticlesSettings,
					requiredRoles: ['Administrator', 'Economy', 'Economy Admin']
				},
				{
					label: 'Semester',
					icon: 'Money',
					component: HolidayPaySettings,
					requiredRoles: ['Administrator']
				},
				{
					label: 'OB-fönster',
					icon: 'Clock',
					component: ObSettings,
					requiredRoles: ['Administrator']
				}
			]
		}
	];

	import { onMount } from 'svelte';
	import { headerState } from '$lib/stores/headerState.svelte';

	let selectedTab = menuItems[0].children[0];

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
