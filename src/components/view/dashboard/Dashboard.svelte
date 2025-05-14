<script lang="ts">
	import CalendarModule from '../../ui/calendarModule/CalendarModule.svelte';
	import DashboardHeader from '../../ui/dashboardHeader/DashboardHeader.svelte';
	import { calendarStore, getWeekStartAndEnd } from '$lib/stores/calendarStore';
	import { goto } from '$app/navigation';
	import TargetModule from '../../ui/targetModule/TargetModule.svelte';
	import DashboardButton from '../../bits/dashboardButton/DashboardButton.svelte';
	import DashboardIcon from './DashboardIcon.svelte';
	import { notificationStore } from '$lib/stores/notificationStore';
	import { on } from 'svelte/events';
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';

	onMount(() => {
		if ($user) {
			notificationStore.updateFromServer($user.id);
		}
	});

	async function handleDateSelect(date: Date) {
		date.setHours(2, 0, 0, 0);
		calendarStore.goToWeek(date, fetch);

		const { weekStart, weekEnd } = getWeekStartAndEnd(date);

		goto(`/calendar?from=${weekStart}&to=${weekEnd}`);
	}

	$: clientNotifications = $notificationStore.byType.client ?? 0;

	$: buttons = [
		{ label: 'Kalender', icon: 'Calendar', href: '/calendar' },
		{ label: 'Tränare', icon: 'Person', href: '/users' },
		{
			label: 'Klienter',
			icon: 'Clients',
			href: '/clients',
			notificationCount: clientNotifications
		},
		{ label: 'Nyheter', icon: 'Newspaper', href: '/news' },
		{ label: 'Rapporter', icon: 'Charts', href: '/reports' },
		{ label: 'Inställningar', icon: 'Settings', href: '/settings' }
	];
</script>

<div class="flex h-full w-[320px] flex-col justify-between gap-4">
	<div class="flex flex-col gap-4">
		<DashboardHeader />
		<CalendarModule on:dateSelect={(e) => handleDateSelect(e.detail)} />
		<TargetModule />

		<div class="space-between flex w-full flex-row flex-wrap gap-4">
			{#each buttons as button}
				<DashboardButton
					label={button.label}
					icon={button.icon}
					href={button.href}
					notificationCount={button.notificationCount}
				/>
			{/each}
		</div>
	</div>

	<div class="mb-2">
		<DashboardIcon></DashboardIcon>
	</div>
</div>
