<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { user as currentUser } from '$lib/stores/userStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import AbsenceAvailability from './absenceAvailability/AbsenceAvailability.svelte';
	import { fetchAvailability, saveOrUpdateAbsences } from '$lib/services/api/availabilityService';

	type AbsenceEntry = {
		id?: number;
		description?: string;
		start_time?: string;
		end_time?: string | null;
		status?: string;
		approved_by_id?: number;
		resetApproval?: boolean;
	};

	let selectedUserId = $state<number | null>(null);
	let isAdmin = $state(false);
	let currentUserId = $state<number | null>(null);
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
		isAdmin = hasRole('Administrator', me as any);
	});

	async function loadAbsenceData(userId: number) {
		const token = ++loadToken;

		try {
			const result = await fetchAvailability(userId);
			if (token !== loadToken) return;

			absences = result.absences ?? [];
		} catch (err) {
			if (token !== loadToken) return;
			console.error('Kunde inte ladda frånvaro:', err);
		}
	}

	$effect(() => {
		if (!selectedUserId) {
			return;
		}

		loadAbsenceData(selectedUserId);
	});

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
		const approverId = currentUserId;

		try {
			await saveOrUpdateAbsences(approverId, [
				{
					id: absence.id,
					approverId
				}
			]);

			absences = absences.map((a) =>
				a.id === absence.id ? { ...a, approved_by_id: approverId } : a
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
		class="border-gray flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-center lg:justify-between"
	>
		<h2 class="text-xl font-semibold">Frånvaro</h2>

		<div class="w-96 max-w-full">
			<Dropdown
				label="Användare"
				labelIcon="Person"
				labelIconSize="16px"
				placeholder="Välj användare"
				id="absence-user-dropdown"
				options={$users.map((u) => ({ label: `${u.firstname} ${u.lastname}`, value: u.id }))}
				bind:selectedValue={selectedUserId}
				search
				maxNumberOfSuggestions={15}
				infiniteScroll
				noLabel
			/>
		</div>
	</div>

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
