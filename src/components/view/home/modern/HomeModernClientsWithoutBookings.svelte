<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import { cacheFirstJson } from '$lib/services/api/apiCache';
	import { user } from '$lib/stores/userStore';
	import HomeModernClientGroup from './HomeModernClientGroup.svelte';
	import type {
		HomeModernClient,
		HomeModernClientsWithoutBookingsResponse
	} from './homeModernTypes';

	let mounted = false;
	let clientsThisWeek: HomeModernClient[] = [];
	let clientsNextWeek: HomeModernClient[] = [];
	let clientsWeekAfter: HomeModernClient[] = [];
	let clientsLoading = true;
	let clientsUserId: number | null = null;

	$: totalMissingClients =
		clientsThisWeek.length + clientsNextWeek.length + clientsWeekAfter.length;

	onMount(() => {
		mounted = true;

		if ($user?.id) {
			clientsUserId = $user.id;
			void fetchClientsWithoutBookings();
		} else {
			clientsLoading = false;
		}
	});

	$: if (mounted && $user?.id && $user.id !== clientsUserId) {
		clientsUserId = $user.id;
		void fetchClientsWithoutBookings();
	}

	$: if (mounted && !$user?.id && clientsUserId !== null) {
		clientsUserId = null;
		clientsThisWeek = [];
		clientsNextWeek = [];
		clientsWeekAfter = [];
		clientsLoading = false;
	}

	async function fetchClientsWithoutBookings() {
		if (!$user?.id) return;

		clientsLoading = true;

		const url = `/api/clients-without-bookings?trainer_id=${$user.id}`;
		const { cached, fresh } = cacheFirstJson<HomeModernClientsWithoutBookingsResponse>(fetch, url);

		if (cached) {
			clientsThisWeek = cached.thisWeek ?? [];
			clientsNextWeek = cached.week1 ?? [];
			clientsWeekAfter = cached.week2 ?? [];
			clientsLoading = false;
		}

		fresh
			.then((data) => {
				clientsThisWeek = data.thisWeek ?? [];
				clientsNextWeek = data.week1 ?? [];
				clientsWeekAfter = data.week2 ?? [];
			})
			.catch((error) => {
				console.error('Failed to load clients without bookings', error);
			})
			.finally(() => {
				clientsLoading = false;
			});
	}
</script>

<section class="bg-white p-5 shadow-sm">
	<div class="mb-4 flex items-center">
		<h2 class="flex items-center gap-2 text-lg font-semibold text-gray-900">
			<Icon icon="Person" size="18px" color="primary" />
			Klienter utan bokningar
		</h2>
	</div>
	{#if clientsLoading}
		<div class="flex h-24 items-center justify-center">
			<div
				class="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
			></div>
		</div>
	{:else if totalMissingClients === 0}
		<div class="flex h-24 flex-col items-center justify-center text-gray-400">
			<Icon icon="Check" size="24px" />
			<p class="mt-1 text-sm">Alla har bokningar!</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#if clientsThisWeek.length > 0}
				<HomeModernClientGroup
					label="Denna vecka"
					clients={clientsThisWeek}
					chipClass="bg-red/10 text-red-800 hover:bg-red/20"
				/>
			{/if}
			{#if clientsNextWeek.length > 0}
				<HomeModernClientGroup
					label="Nästa vecka"
					clients={clientsNextWeek}
					chipClass="bg-orange/10 text-orange hover:bg-orange/20"
				/>
			{/if}
			{#if clientsWeekAfter.length > 0}
				<HomeModernClientGroup label="Om 2 veckor" clients={clientsWeekAfter} />
			{/if}
		</div>
	{/if}
</section>
