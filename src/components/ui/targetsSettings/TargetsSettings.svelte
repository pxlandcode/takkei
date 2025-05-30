<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { targetStore, updateTargets } from '$lib/stores/targetsStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import { createTarget } from '$lib/services/api/targetService';

	import TextArea from '../../bits/textarea/TextArea.svelte';
	import Button from '../../bits/button/Button.svelte';
	import DropdownCheckbox from '../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import FilterBox from '../../bits/filterBox/FilterBox.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import Input from '../../bits/Input/Input.svelte';

	let userId = 19;
	let today = new Date().toISOString().slice(0, 10);

	let selectedUsers = [];
	let selectedLocations = [];

	const targetKinds = [
		{ id: 1, name: 'Booking Count' },
		{ id: 2, name: 'Location Bookings' }
	];

	let newTarget = {
		title: '',
		description: '',
		target: 0,
		target_kind_id: 1,
		user_ids: [],
		location_ids: [],
		start_date: today,
		end_date: today
	};

	onMount(async () => {
		await Promise.all([fetchUsers(), fetchLocations()]);
		updateTargets(userId, today);
	});

	function handleUserChange(e) {
		selectedUsers = [...e.detail.selected];
	}

	function handleLocationChange(e) {
		selectedLocations = [...e.detail.selected];
	}

	async function submitTarget() {
		newTarget.user_ids = selectedUsers.map((u) => u.id);
		newTarget.location_ids = selectedLocations.map((l) => l.id);

		if (!newTarget.title || !newTarget.target) {
			return showError('Fyll i titel och målvärde.');
		}

		if (newTarget.target_kind_id === 1 && newTarget.user_ids.length === 0) {
			return showError('Välj minst en användare för detta mål.');
		}

		if (newTarget.target_kind_id === 2 && newTarget.location_ids.length === 0) {
			return showError('Välj minst en lokal för detta mål.');
		}

		try {
			await createTarget(newTarget); // ✅ no `rules` passed
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Mål skapat!',
				description: `Målet "${newTarget.title}" sparades.`
			});
			updateTargets(userId, today);
			resetForm();
		} catch (err) {
			showError('Kunde inte spara mål', err.message);
		}
	}

	function resetForm() {
		newTarget = {
			title: '',
			description: '',
			target: 0,
			target_kind_id: 1,
			user_ids: [],
			location_ids: [],
			start_date: today,
			end_date: today
		};
		selectedUsers = [];
		selectedLocations = [];
	}

	function showError(message: string, description = '') {
		addToast({ type: AppToastType.CANCEL, message, description });
	}
</script>

<div class="flex w-full max-w-[800px] flex-col gap-4">
	<h2 class="text-xl font-bold text-text">Mål & Prestationer</h2>

	<!-- Create new -->
	<div class="rounded-lg border bg-gray-50 p-4 shadow-sm">
		<h3 class="mb-2 text-lg font-semibold">Lägg till nytt mål</h3>

		<Input label="Titel" name="title" bind:value={newTarget.title} />
		<TextArea label="Beskrivning" name="description" bind:value={newTarget.description} />
		<Input type="number" label="Mål (t.ex. 50)" name="target" bind:value={newTarget.target} />

		<label class="text-sm font-medium">Måltyp</label>
		<select bind:value={newTarget.target_kind_id} class="w-full rounded border p-2">
			{#each targetKinds as kind}
				<option value={kind.id}>{kind.name}</option>
			{/each}
		</select>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<Input type="date" label="Startdatum" name="start_date" bind:value={newTarget.start_date} />
			<Input type="date" label="Slutdatum" name="end_date" bind:value={newTarget.end_date} />
		</div>

		<div class="flex flex-col gap-2">
			{#if newTarget.target_kind_id === 1}
				<DropdownCheckbox
					label="Användare"
					placeholder="Välj användare"
					id="users"
					options={$users.map((u) => ({ name: `${u.firstname} ${u.lastname}`, value: u }))}
					bind:selectedValues={selectedUsers}
					on:change={handleUserChange}
					search
				/>
			{/if}

			{#if newTarget.target_kind_id === 2}
				<DropdownCheckbox
					label="Lokaler"
					placeholder="Välj lokaler"
					id="locations"
					options={$locations.map((l) => ({ name: l.name, value: l }))}
					bind:selectedValues={selectedLocations}
					on:change={handleLocationChange}
					search
				/>
			{/if}

			<FilterBox
				title="Mottagare"
				{selectedUsers}
				{selectedLocations}
				on:removeFilter={(e) => {
					const { type, id } = e.detail;
					if (type === 'trainer') selectedUsers = selectedUsers.filter((u) => u.id !== id);
					if (type === 'location') selectedLocations = selectedLocations.filter((l) => l.id !== id);
				}}
			/>

			<Button full text="Spara mål" iconRight="Save" iconRightSize="16px" on:click={submitTarget} />
		</div>
	</div>
</div>
