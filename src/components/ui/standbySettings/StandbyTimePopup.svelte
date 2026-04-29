<script lang="ts">
	import { Datepicker } from '@pixelcode_/blocks/components';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import Button from '../../bits/button/Button.svelte';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import DropdownCheckbox from '../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import TextArea from '../../bits/textarea/TextArea.svelte';
	import { closePopup } from '$lib/stores/popupStore';
	import { user } from '$lib/stores/userStore';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { clients, fetchClients } from '$lib/stores/clientsStore';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import {
		StandbyApiError,
		createStandbyTime,
		updateStandbyTime
	} from '$lib/services/api/standbyTimeService';
	import type {
		StandbyMutationPayload,
		StandbyMutationResponse,
		StandbyTimeRecord
	} from '$lib/types/standbyTypes';

	export let standbyTime: StandbyTimeRecord | null = null;
	export let onSaved: ((result: StandbyMutationResponse) => void | Promise<void>) | null = null;

	const currentUser = get(user);
	const currentTrainerId =
		currentUser?.kind === 'trainer'
			? Number(currentUser.id ?? currentUser.trainerId ?? 0) || null
			: null;

	let date = standbyTime?.date ?? '';
	let startTime = standbyTime?.startTime ?? '';
	let endTime = standbyTime?.endTime ?? '';
	let selectedClientId: number | '' = standbyTime?.clientId ?? '';
	let selectedLocationIds = standbyTime?.locationIds ? [...standbyTime.locationIds] : [];
	let selectedTrainerIds =
		standbyTime?.trainerIds && standbyTime.trainerIds.length > 0
			? [...standbyTime.trainerIds]
			: currentTrainerId
				? [currentTrainerId]
				: [];
	let comment = standbyTime?.comment ?? '';
	let errors: Record<string, string> = {};
	let submitting = false;

	const datepickerOptions = {
		dateFormat: 'yyyy-MM-dd'
	} as const;

	onMount(async () => {
		const fetches: Promise<void>[] = [];
		if (get(users).length === 0) fetches.push(fetchUsers());
		if (get(clients).length === 0) fetches.push(fetchClients());
		if (get(locations).length === 0) fetches.push(fetchLocations());
		await Promise.all(fetches);
	});

	$: clientOptions = [
		{ label: 'Ingen kund', value: '' },
		...$clients.map((client) => ({
			label: `${client.firstname} ${client.lastname}`,
			value: client.id
		}))
	];

	$: trainerOptions = $users
		.filter((trainer) => trainer.active !== false || trainer.id === currentTrainerId)
		.map((trainer) => ({
			name: `${trainer.firstname} ${trainer.lastname}`,
			value: trainer.id
		}));

	$: locationOptions = $locations.map((location) => ({
		name: location.name,
		value: location.id
	}));

	function handleTrainerSelection(event: CustomEvent<{ selected: number[] }>) {
		selectedTrainerIds = [...event.detail.selected];
	}

	function handleLocationSelection(event: CustomEvent<{ selected: number[] }>) {
		selectedLocationIds = [...event.detail.selected];
	}

	function buildPayload(): StandbyMutationPayload {
		return {
			clientId: selectedClientId === '' ? null : Number(selectedClientId),
			locationIds: selectedLocationIds,
			trainerIds: selectedTrainerIds,
			date,
			startTime,
			endTime,
			comment: comment.trim() || null
		};
	}

	async function handleSubmit() {
		errors = {};
		submitting = true;

		try {
			const payload = buildPayload();
			const result = standbyTime
				? await updateStandbyTime(standbyTime.id, payload)
				: await createStandbyTime(payload);

			if (onSaved) {
				await onSaved(result);
			}
			closePopup();
		} catch (error) {
			if (error instanceof StandbyApiError) {
				errors = Object.keys(error.errors).length > 0 ? error.errors : { general: error.message };
			} else {
				console.error('Failed to save standby time', error);
				errors = { general: 'Kunde inte spara standbytiden. Försök igen.' };
			}
		} finally {
			submitting = false;
		}
	}
</script>

<div class="w-full min-w-0 space-y-4 sm:min-w-[36rem]">
	<div class="rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
		Sluttiden är senaste möjliga starttid. Om kunden vill träna till 18:00 ska du ange 17:00.
	</div>

	<div class="grid gap-4 md:grid-cols-3">
		<div class="flex flex-col gap-1">
			<p class="text-gray mb-1 block text-sm font-medium">Datum</p>
			<Datepicker
				bind:value={date}
				options={datepickerOptions}
				placeholder="Välj datum"
				class="border-gray !h-[42px] rounded border bg-white text-sm text-black transition-colors duration-150 focus-visible:outline-blue-500"
			/>
			{#if errors.date}
				<p class="text-sm text-red-500">{errors.date}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1">
			<label class="text-gray mb-1 block text-sm font-medium" for="standby-start">Från tid</label>
			<input
				id="standby-start"
				type="time"
				step="1800"
				bind:value={startTime}
				class="border-gray h-[42px] w-full rounded border bg-white px-3 text-sm text-black transition-colors duration-150 focus:outline-blue-500"
			/>
			{#if errors.startTime}
				<p class="text-sm text-red-500">{errors.startTime}</p>
			{/if}
		</div>

		<div class="flex flex-col gap-1">
			<label class="text-gray mb-1 block text-sm font-medium" for="standby-end"> Till tid </label>
			<input
				id="standby-end"
				type="time"
				step="1800"
				bind:value={endTime}
				class="border-gray h-[42px] w-full rounded border bg-white px-3 text-sm text-black transition-colors duration-150 focus:outline-blue-500"
			/>
			{#if errors.endTime}
				<p class="text-sm text-red-500">{errors.endTime}</p>
			{/if}
		</div>
	</div>

	<div class="grid gap-4 md:grid-cols-2">
		<Dropdown
			id="clientId"
			label="Kund"
			placeholder="Välj kund"
			options={clientOptions}
			bind:selectedValue={selectedClientId}
			search={clientOptions.length > 10}
			{errors}
		/>

		<DropdownCheckbox
			id="trainerIds"
			label="Tränare som ska få mail"
			placeholder="Välj tränare"
			options={trainerOptions}
			bind:selectedValues={selectedTrainerIds}
			on:change={handleTrainerSelection}
			search={trainerOptions.length > 10}
			errors={errors.trainerIds ? [errors.trainerIds] : undefined}
		/>
	</div>

	<DropdownCheckbox
		id="locationIds"
		label="Platser"
		placeholder="Välj platser"
		options={locationOptions}
		bind:selectedValues={selectedLocationIds}
		on:change={handleLocationSelection}
		search={locationOptions.length > 8}
		errors={errors.locationIds ? [errors.locationIds] : undefined}
	/>

	<TextArea
		label="Kommentar"
		name="comment"
		placeholder="Lägg till en kommentar"
		bind:value={comment}
		{errors}
	/>

	{#if errors.general}
		<div class="rounded-sm border border-red-200 bg-red-50 p-3 text-sm text-red-800">
			{errors.general}
		</div>
	{/if}

	<div class="flex justify-end gap-2">
		<Button text="Avbryt" variant="secondary" on:click={closePopup} />
		<Button
			text={submitting ? 'Sparar...' : standbyTime ? 'Spara ändringar' : 'Skapa standbytid'}
			iconRight="Save"
			variant="primary"
			disabled={submitting}
			on:click={handleSubmit}
		/>
	</div>
</div>
