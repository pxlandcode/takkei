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
	import PopupWrapper from '../../../components/ui/popupWrapper/PopupWrapper.svelte';
	import MailComponent from '../../../components/ui/mailComponent/MailComponent.svelte';

	let trainerId: number;
	let profile = null;
	let trainer = null;
	let showMailPopup = false;

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

	let selectedTab = menuItems[0];

	onMount(async () => {
		if (trainerId) await profileStore.loadUser(trainerId, fetch);
	});

	$: {
		if ($profileStore.users[trainerId]) {
			profile = $profileStore.users[trainerId];
			trainer = profile.user;
		}
	}
</script>

<!-- Page Header -->
<div class="m-4 ml-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
	<div class="flex flex-row items-center gap-2">
		<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Person" size="18px" />
		</div>
		<h2 class="text-3xl font-semibold text-text">
			{trainer ? `${trainer.firstname} ${trainer.lastname}` : 'Laddar tränare...'}
		</h2>
	</div>

	<div class="mr-14 flex space-x-2 md:mr-0">
		<Button icon="Mail" variant="secondary" on:click={() => (showMailPopup = true)} />
		<Button icon="Calendar" variant="secondary" />
		<Button iconLeft="Plus" iconLeftSize="12px" text="Boka" variant="primary" icon="Plus" />
	</div>
</div>

<Navigation {menuItems} bind:selectedTab>
	{#if selectedTab.component && (!selectedTab.props || Object.keys(selectedTab.props()).length > 0)}
		<svelte:component this={selectedTab.component} {...selectedTab.props()} />
	{:else}
		<p class="text-gray-500">Innehåll kommer snart.</p>
	{/if}
</Navigation>

{#if showMailPopup && trainer}
	<PopupWrapper
		width="900px"
		header="Maila {trainer.firstname} {trainer.lastname}"
		icon="Mail"
		on:close={() => (showMailPopup = false)}
	>
		<MailComponent
			prefilledRecipients={[trainer.email]}
			lockedFields={['recipients']}
			autoFetchUsersAndClients={false}
		/>
	</PopupWrapper>
{/if}
