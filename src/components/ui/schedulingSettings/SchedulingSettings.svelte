<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { user as currentUser } from '$lib/stores/userStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';

	import WeeklyAvailability from './weeklyAvailability/WeeklyAvailability.svelte';
	import DateAvailability from './dateAvailability/DateAvailability.svelte';
	import VacationAvailability from './vacationAvailability/VacationAvailability.svelte';

	import {
		fetchAvailability,
		saveWeeklyAvailability,
		saveDateAvailability,
		saveVacations,
		removeDateAvailability,
		removeVacation,
		saveOrUpdateAbsences
	} from '$lib/services/api/availabilityService';
	import AbsenceAvailability from './absenceAvailability/AbsenceAvailability.svelte';

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

	type VacationEntry = {
		id?: number;
		start_date: string;
		end_date: string;
	};

	type AbsenceEntry = {
		id?: number;
		description?: string;
		start_time?: string;
		end_time?: string | null;
		status?: string;
		approved_by_id?: number;
	};

	let selectedUserId = $state<number | null>(null);
	let isAdmin = $state(false);
	let currentUserId = $state<number | null>(null);

	let weeklyAvailability = $state<WeeklyEntry[]>([]);
	let dateAvailabilities = $state<DateAvailabilityEntry[]>([]);
	let vacations = $state<VacationEntry[]>([]);
	let absences = $state<AbsenceEntry[]>([]);

	let loadToken = 0;

	const canEdit = $derived(
		isAdmin || (!!selectedUserId && !!currentUserId && selectedUserId === currentUserId)
	);
	const canApprove = $derived(isAdmin);

	onMount(async () => {
		await fetchUsers();
		const me = get(currentUser);
		currentUserId = me?.id ?? null;
		selectedUserId = currentUserId;
		isAdmin = hasRole('Administrator', me);
	});

	async function loadAvailabilityData(userId: number) {
		const token = ++loadToken;

		try {
			const result = await fetchAvailability(userId);
			if (token !== loadToken) return;

			weeklyAvailability = result.weekly ?? [];
			dateAvailabilities = result.dates ?? [];
			vacations = result.vacations ?? [];
			absences = result.absences ?? [];
		} catch (err) {
			if (token !== loadToken) return;
			console.error('Kunde inte ladda tillgänglighet:', err);
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

	async function handleVacationSave(entry: VacationEntry) {
		if (!selectedUserId) return;
		try {
			await saveVacations(selectedUserId, [entry]);
			await loadAvailabilityData(selectedUserId);
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

	async function handleAbsenceSave(absence: AbsenceEntry) {
		if (!selectedUserId) return;
		try {
			const saved = await saveOrUpdateAbsences(selectedUserId, [absence]);
			if (!saved.length) return;

			const next = [...absences];
			for (const item of saved) {
				const index = next.findIndex((x) => x.id === item.id);
				if (index !== -1) {
					next[index] = item;
				} else {
					next.unshift(item);
				}
			}
			absences = next;
		} catch (err) {
			console.error('❌ Failed to save absence(s):', err);
		}
	}

	async function approveAbsence(absence: AbsenceEntry) {
		if (!currentUserId || !absence.id) return;
		try {
			await saveOrUpdateAbsences(currentUserId, [
				{
					id: absence.id,
					approverId: currentUserId
				}
			]);

			absences = absences.map((a) =>
				a.id === absence.id ? { ...a, approved_by_id: currentUserId } : a
			);
		} catch (err) {
			console.error('❌ Failed to approve absence:', err);
		}
	}

	async function closeAbsence(absence: AbsenceEntry) {
		if (!currentUserId || !absence.id) return;

		try {
			const now = new Date().toISOString();

			const updated = await saveOrUpdateAbsences(currentUserId, [
				{
					id: absence.id,
					end_time: now,
					status: 'Closed'
				}
			]);

			if (!updated.length) return;

			absences = absences.map((a) => (a.id === absence.id ? updated[0] : a));
		} catch (err) {
			console.error('❌ Failed to close absence:', err);
		}
	}
</script>

<div class="mb-24 w-full space-y-6">
	<div
		class="flex flex-col gap-4 border-b border-gray pb-4 lg:flex-row lg:items-center lg:justify-between"
	>
		<h2 class="text-xl font-semibold">Schema</h2>

		<div class="w-96">
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

	<VacationAvailability
		{vacations}
		{canEdit}
		on:save={(e) => handleVacationSave(e.detail)}
		on:remove={(e) => handleVacationRemove(e.detail)}
	/>

	{#if canEdit}
		<AbsenceAvailability
			{absences}
			{canEdit}
			{canApprove}
			on:save={(e) => handleAbsenceSave(e.detail)}
			on:close={(e) => closeAbsence(e.detail)}
			on:approve={(e) => approveAbsence(e.detail)}
		/>
	{/if}
</div>
