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

	let selectedUserId: number | null = null;
	let isAdmin = false;
	let currentUserId: number;

	let weeklyAvailability = [];
	let dateAvailabilities = [];
	let vacations = [];
	let absences = [];

	onMount(async () => {
		await fetchUsers();
		const me = get(currentUser);
		currentUserId = me?.id;
		selectedUserId = currentUserId;
		isAdmin = hasRole('Administrator', me);

		await loadAvailabilityData();
	});

	$: if (selectedUserId !== null) {
		loadAvailabilityData();
	}

	async function loadAvailabilityData() {
		if (!selectedUserId) return;

		try {
			const result = await fetchAvailability(selectedUserId);

			weeklyAvailability = result.weekly || [];
			dateAvailabilities = result.dates || [];
			vacations = result.vacations || [];
			absences = result.absences || [];
		} catch (err) {
			console.error('Kunde inte ladda tillgänglighet:', err);
		}
	}

	function canEdit() {
		return isAdmin || selectedUserId === currentUserId;
	}

	function canApprove() {
		return isAdmin;
	}

	async function saveWeekly(data) {
		if (!selectedUserId) return;
		try {
			await saveWeeklyAvailability(selectedUserId, data);
		} catch (err) {
			console.error('❌ Weekly save failed', err);
		}
	}

	async function saveDates(data) {
		if (!selectedUserId) return;
		try {
			await saveDateAvailability(selectedUserId, data);
		} catch (err) {
			console.error('❌ Date save failed', err);
		}
	}

	async function removeDate(id: number) {
		try {
			await removeDateAvailability(id);
			dateAvailabilities = dateAvailabilities.filter((d) => d.id !== id);
		} catch (err) {
			console.error('❌ Failed to remove date availability:', err);
		}
	}

	async function saveVacation(data) {
		if (!selectedUserId) return;
		try {
			await saveVacations(selectedUserId, data);
			vacations = [...vacations, data];
		} catch (err) {
			console.error('❌ Vacation save failed', err);
		}
	}

	async function removeVacationEntry(id: number) {
		try {
			await removeVacation(id);
			vacations = vacations.filter((v) => v.id !== id);
		} catch (err) {
			console.error('❌ Failed to remove vacation:', err);
		}
	}

	async function saveAbsence(data) {
		if (!selectedUserId) return;
		try {
			const saved = await saveOrUpdateAbsences(selectedUserId, data);

			for (const a of saved) {
				const index = absences.findIndex((x) => x.id === a.id);
				if (index !== -1) {
					absences[index] = a;
				} else {
					absences = [a, ...absences];
				}
			}
		} catch (err) {
			console.error('❌ Failed to save absence(s):', err);
		}
	}

	async function approveAbsence(absence) {
		if (!currentUserId) return;
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

	async function closeAbsence(absence) {
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
		on:save={(e) => {
			weeklyAvailability = e.detail;
			saveWeekly(e.detail);
		}}
	/>

	<DateAvailability
		{dateAvailabilities}
		{canEdit}
		on:save={(e) => {
			dateAvailabilities = [...dateAvailabilities, e.detail];
			saveDates([e.detail]);
		}}
		on:remove={(e) => {
			removeDate(e.detail);
		}}
	/>

	<VacationAvailability
		{vacations}
		{canEdit}
		on:save={(e) => {
			vacations = [...vacations, e.detail];
			saveVacation([e.detail]);
		}}
		on:remove={(e) => {
			removeVacationEntry(e.detail);
		}}
	/>

	{#if isAdmin || selectedUserId === currentUserId}
		<AbsenceAvailability
			{absences}
			{canEdit}
			{canApprove}
			on:save={(e) => {
				saveAbsence([e.detail]);
			}}
			on:close={(e) => {
				closeAbsence(e.detail);
			}}
			on:approve={(e) => {
				approveAbsence(e.detail);
			}}
		/>
	{/if}
</div>
