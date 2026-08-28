<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { user as currentUser } from '$lib/stores/userStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import VacationAvailability from './vacationAvailability/VacationAvailability.svelte';
	import {
		fetchAvailability,
		saveVacations,
		removeVacation
	} from '$lib/services/api/availabilityService';

	type VacationEntry = {
		id?: number;
		start_date: string;
		end_date: string;
	};

	let selectedUserId = $state<number | null>(null);
	let isAdmin = $state(false);
	let currentUserId = $state<number | null>(null);
	let vacations = $state<VacationEntry[]>([]);
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

	async function loadVacationData(userId: number) {
		const token = ++loadToken;

		try {
			const result = await fetchAvailability(userId);
			if (token !== loadToken) return;

			vacations = result.vacations ?? [];
		} catch (err) {
			if (token !== loadToken) return;
			console.error('Kunde inte ladda semester:', err);
		}
	}

	$effect(() => {
		if (!selectedUserId) {
			return;
		}

		loadVacationData(selectedUserId);
	});

	async function handleVacationSave(entry: VacationEntry) {
		if (!selectedUserId) return;
		try {
			await saveVacations(selectedUserId, [entry]);
			await loadVacationData(selectedUserId);
		} catch (err) {
			console.error('❌ Vacation save failed', err);
		}
	}

	async function handleVacationRemove(id: number) {
		try {
			await removeVacation(id);
			vacations = vacations.filter((v) => v.id !== id);
		} catch (err) {
			console.error('❌ Failed to remove vacation:', err);
		}
	}
</script>

<div class="mb-24 w-full space-y-6">
	<div
		class="border-gray flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-center lg:justify-between"
	>
		<h2 class="text-xl font-semibold">Semester</h2>

		<div class="w-96 max-w-full">
			<Dropdown
				label="Användare"
				labelIcon="Person"
				labelIconSize="16px"
				placeholder="Välj användare"
				id="vacation-user-dropdown"
				options={$users.map((u) => ({ label: `${u.firstname} ${u.lastname}`, value: u.id }))}
				bind:selectedValue={selectedUserId}
				search
				maxNumberOfSuggestions={15}
				infiniteScroll
				noLabel
			/>
		</div>
	</div>

	<VacationAvailability
		{vacations}
		{canEdit}
		on:save={(e) => handleVacationSave(e.detail)}
		on:remove={(e) => handleVacationRemove(e.detail)}
	/>
</div>
