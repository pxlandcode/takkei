<script lang="ts">
	import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';
	import Icon from '../../icon-component/Icon.svelte';

	let clientsWeek1: any[] = [];
	let clientsWeek2: any[] = [];
	let isLoading = true;

	let week1Start: Date;
	let week1End: Date;
	let week2Start: Date;
	let week2End: Date;

	$: $user;

	// Format as "10 juni"
	function formatDate(date: Date): string {
		return date.toLocaleDateString('sv-SE', {
			day: 'numeric',
			month: 'long'
		});
	}

	function getDateRanges() {
		const today = new Date();
		const currentDay = today.getDay();
		const daysUntilNextMonday = (8 - currentDay) % 7 || 7;

		week1Start = new Date(today);
		week1Start.setDate(today.getDate() + daysUntilNextMonday);
		week1Start.setHours(0, 0, 0, 0);

		week1End = new Date(week1Start);
		week1End.setDate(week1Start.getDate() + 6);

		week2Start = new Date(week1End);
		week2Start.setDate(week2Start.getDate() + 1);

		week2End = new Date(week2Start);
		week2End.setDate(week2Start.getDate() + 6);
	}

	async function fetchClientsWithoutBookings() {
		if (!$user?.id) return;

		getDateRanges();
		isLoading = true;

		try {
			const res = await fetch(`/api/clients-without-bookings?trainer_id=${$user.id}`);
			if (res.ok) {
				const data = await res.json();
				clientsWeek1 = data.week1;
				clientsWeek2 = data.week2;
			}
		} finally {
			isLoading = false;
		}
	}

	onMount(fetchClientsWithoutBookings);
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-md">
	<div class="mb-3 flex items-center gap-2">
		<div class="flex h-6 w-6 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="CircleUser" size="14px" />
		</div>
		<h3 class="text-lg font-semibold text-text">Klienter utan bokningar</h3>
	</div>

	{#if isLoading}
		<p class="text-sm text-text">Laddar...</p>
	{:else if clientsWeek1.length === 0 && clientsWeek2.length === 0}
		<p class="text-sm text-text">Alla klienter har bokningar de kommande veckorna 🎉</p>
	{:else}
		<div class="grid grid-cols-2 gap-4 text-sm text-text">
			<!-- Week 1 -->
			<div>
				<div class="mb-2 flex flex-col gap-1">
					<h4 class=" font-semibold text-gray-700">Nästa vecka</h4>
					<p class="text-xs text-gray-400">({formatDate(week1Start)} – {formatDate(week1End)})</p>
				</div>

				<ul class="space-y-1">
					{#each clientsWeek1 as client}
						<li>
							<a class="text-orange hover:underline" href={`/clients/${client.id}`}
								>{client.firstname} {client.lastname}</a
							>
						</li>
					{/each}
					{#if clientsWeek1.length === 0}
						<li class="text-xs italic text-gray-400">Alla är bokade 💪</li>
					{/if}
				</ul>
			</div>

			<!-- Week 2 -->
			<div>
				<div class="mb-2 flex flex-col gap-1">
					<h4 class="font-semibold text-gray-700">Veckan därefter</h4>
					<p class="text-xs text-gray-400">({formatDate(week2Start)} – {formatDate(week2End)})</p>
				</div>
				<ul class="space-y-1">
					{#each clientsWeek2 as client}
						<li>
							<a class="text-orange hover:underline" href={`/clients/${client.id}`}
								>{client.firstname} {client.lastname}</a
							>
						</li>
					{/each}
					{#if clientsWeek2.length === 0}
						<li class="text-xs italic text-gray-400">Alla är bokade 💪</li>
					{/if}
				</ul>
			</div>
		</div>
	{/if}
</div>
