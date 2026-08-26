<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { user as currentUser } from '$lib/stores/userStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';

	import WeeklyAvailability from './weeklyAvailability/WeeklyAvailability.svelte';
	import DateAvailability from './dateAvailability/DateAvailability.svelte';

	import {
		fetchAvailability,
		saveWeeklyAvailability,
		saveDateAvailability,
		removeDateAvailability
	} from '$lib/services/api/availabilityService';

	type WeeklyEntry = {
		id: number | null;
		userId: number | null;
		weekday: number;
		start_time: string;
		end_time: string;
	};

	type DateAvailabilityEntry = {
		id?: number;
		date: string;
		start_time: string;
		end_time: string;
	};

	let selectedUserId = $state<number | null>(null);
	let isAdmin = $state(false);
	let currentUserId = $state<number | null>(null);

	let weeklyAvailability = $state<WeeklyEntry[]>([]);
	let dateAvailabilities = $state<DateAvailabilityEntry[]>([]);

	let loadToken = 0;

	const canEdit = $derived(
		isAdmin || (!!selectedUserId && !!currentUserId && selectedUserId === currentUserId)
	);

	onMount(async () => {
		await fetchUsers();
		const me = get(currentUser);
		currentUserId = me?.id ?? null;
		selectedUserId = currentUserId;
		isAdmin = hasRole('Administrator', me as any);
	});

	async function loadAvailabilityData(userId: number) {
		const token = ++loadToken;

		try {
			const result = await fetchAvailability(userId);
			if (token !== loadToken) return;

			weeklyAvailability = result.weekly ?? [];
			dateAvailabilities = result.dates ?? [];
		} catch (err) {
			if (token !== loadToken) return;
			console.error('Kunde inte ladda schema:', err);
		}
	}

	$effect(() => {
		if (!selectedUserId) {
			return;
		}

		loadAvailabilityData(selectedUserId);
	});

	async function handleWeeklySave(data: WeeklyEntry[]) {
		if (!selectedUserId) return;
		try {
			await saveWeeklyAvailability(selectedUserId, data);
			weeklyAvailability = data;
		} catch (err) {
			console.error('❌ Weekly save failed', err);
		}
	}

	async function handleDateSave(entry: DateAvailabilityEntry) {
		if (!selectedUserId) return;
		try {
			await saveDateAvailability(selectedUserId, [entry]);
			await loadAvailabilityData(selectedUserId);
		} catch (err) {
			console.error('❌ Date save failed', err);
		}
	}

	async function handleDateRemove(id: number) {
		try {
			await removeDateAvailability(id);
			dateAvailabilities = dateAvailabilities.filter((d) => d.id !== id);
		} catch (err) {
			console.error('❌ Failed to remove date availability:', err);
		}
	}
</script>

<div class="mb-24 w-full space-y-6">
	<div
		class="border-gray flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-center lg:justify-between"
	>
		<h2 class="text-xl font-semibold">Schema</h2>

		<div class="w-96 max-w-full">
			<Dropdown
				label="Användare"
				labelIcon="Person"
				labelIconSize="16px"
				placeholder="Välj användare"
				id="user-dropdown"
				options={$users.map((u) => ({ label: `${u.firstname} ${u.lastname}`, value: u.id }))}
				bind:selectedValue={selectedUserId}
				search
				maxNumberOfSuggestions={15}
				infiniteScroll
				noLabel
			/>
		</div>
	</div>

	<WeeklyAvailability
		userId={selectedUserId}
		{weeklyAvailability}
		{canEdit}
		on:save={(e) => handleWeeklySave(e.detail)}
	/>

	<DateAvailability
		{dateAvailabilities}
		{canEdit}
		on:save={(e) => handleDateSave(e.detail)}
		on:remove={(e) => handleDateRemove(e.detail)}
	/>
</div>
