<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { profileStore } from '$lib/stores/profileStore';
	import Icon from '../../../components/bits/icon-component/Icon.svelte';
	import Button from '../../../components/bits/button/Button.svelte';
	import Navigation from '../../../components/bits/navigation/Navigation.svelte';
	import ProfileInfo from '../../../components/ui/ProfileInfo/ProfileInfo.svelte';
	import ProfileBookingComponent from '../../../components/ui/profileBookingComponent/ProfileBookingComponent.svelte';
	import ProfileNotesComponent from '../../../components/ui/profileNotesComponent/ProfileNotesComponent.svelte';
	import MailComponent from '../../../components/ui/mailComponent/MailComponent.svelte';
	import { openPopup } from '$lib/stores/popupStore';
	import { goto } from '$app/navigation';
	import { calendarStore } from '$lib/stores/calendarStore';
	import type { CalendarFilters } from '$lib/stores/calendarStore';
	import { getCalendarUrl } from '$lib/helpers/calendarHelpers/calendarNavigation';
	import { headerState } from '$lib/stores/headerState.svelte';

	let trainerId: number;
	let profile = null;
	let trainer = null;
	let isLoading = true;
	let selectedTabProps: Record<string, unknown> | null = null;
	let canRenderSelectedTab = false;
	let isAwaitingTabData = false;

	$: trainerId = Number($page.params.slug);

	const menuItems = [
		{
			label: 'Profil',
			icon: 'Person',
			component: ProfileInfo,
			props: () => (trainer ? { trainer } : {})
		},
		{
			label: 'Bokningar',
			icon: 'Calendar',
			component: ProfileBookingComponent,
			props: () => (trainerId ? { trainerId } : {})
		},
		{
			label: 'Klienter',
			icon: 'Clients',
			component: null
		},
		{
			label: 'Anteckningar',
			icon: 'Notes',
			component: ProfileNotesComponent,
			props: () => (trainerId ? { targetId: trainerId } : {})
		}
	];

	const defaultTab = menuItems.find((item) => item.label === 'Profil') ?? menuItems[0];
	let selectedTab = defaultTab;

	$: if (!selectedTab && defaultTab) {
		selectedTab = defaultTab;
	}

	onMount(async () => {
		if (!trainerId) {
			isLoading = false;
			return;
		}

		isLoading = true;
		try {
			await profileStore.loadUser(trainerId, fetch);
		} catch (error) {
			console.error('Failed to load trainer profile:', error);
		} finally {
			isLoading = false;
		}
	});

	$: {
		const storeData = $profileStore.users[trainerId];
		if (storeData) {
			profile = storeData;
			trainer = profile.user;
			isLoading = false;
			if (trainer) {
				headerState.title = `${trainer.firstname} ${trainer.lastname}`;
				headerState.icon = 'Person';
			}
		}
	}

	$: {
		trainer;
		trainerId;
		const props = selectedTab?.props ? selectedTab.props() : null;
		selectedTabProps = props;
		isAwaitingTabData =
			Boolean(selectedTab?.component) &&
			Boolean(selectedTab?.props) &&
			(!props || Object.keys(props).length === 0);
		canRenderSelectedTab = Boolean(selectedTab?.component) && !isAwaitingTabData;
	}

	function openMailPopup() {
		if (!trainer?.email) return;
		openPopup({
			header: `Maila ${trainer.firstname ?? ''} ${trainer.lastname ?? ''}`.trim(),
			icon: 'Mail',
			component: MailComponent,
			maxWidth: '900px',
			props: {
				prefilledRecipients: [trainer.email],
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			}
		});
	}

	function goToCalendar() {
		if (!trainerId) return;
		const filters: Partial<CalendarFilters> = { trainerIds: [trainerId] };
		calendarStore.setNewFilters(filters, fetch);
		goto(getCalendarUrl(filters));
	}
</script>

<!-- Page Header -->
<div class="m-4 ml-3 hidden shrink-0 flex-wrap items-center justify-between gap-2 md:flex">
	<div class="flex flex-row items-center gap-2">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Person" size="18px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">
			{trainer ? `${trainer.firstname} ${trainer.lastname}` : 'Laddar tränare...'}
		</h2>
	</div>

	<div class="mr-14 flex space-x-2 md:mr-0">
		<Button icon="Mail" variant="secondary" on:click={openMailPopup} />
		<Button icon="Calendar" variant="secondary" on:click={goToCalendar} />
		<Button iconLeft="Plus" iconLeftSize="12px" text="Boka" variant="primary" icon="Plus" />
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
