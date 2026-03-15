<script lang="ts">
	import Input from '../../bits/Input/Input.svelte';
	import Button from '../../bits/button/Button.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import { Datepicker } from '@pixelcode_/blocks/components';
	import { dispatchAbsenceUpdated } from '$lib/helpers/availability/currentAbsence';
	import { saveOrUpdateAbsences } from '$lib/services/api/availabilityService';
	import { closePopup } from '$lib/stores/popupStore';

	type SavedAbsence = {
		id: number;
		description?: string | null;
		start_time?: string | null;
		end_time?: string | null;
		status?: string | null;
	};

	export let userId: number;
	export let onSaved: (absence: SavedAbsence) => void | Promise<void> = async () => {};

	let description = '';
	let startDate = getTodayDate();
	let endDate = '';
	let saving = false;
	let error: string | null = null;
	let validationErrors: Record<string, string> = {};

	const datepickerOptions = {
		dateFormat: 'yyyy-MM-dd'
	} as const;

	function getTodayDate() {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	$: trimmedDescription = description.trim();
	$: hasInvalidDateSpan = Boolean(startDate && endDate && endDate < startDate);
	$: canSave = Boolean(trimmedDescription && startDate && !hasInvalidDateSpan);

	function resetErrors() {
		error = null;
		validationErrors = {};
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		resetErrors();

		if (!trimmedDescription) {
			validationErrors.description = 'Beskrivning krävs';
			error = 'Lägg till en beskrivning för frånvaron.';
			return;
		}
		if (hasInvalidDateSpan) {
			error = 'Slutdatum kan inte vara före startdatum.';
			return;
		}

		saving = true;
		try {
			const [savedAbsence] = await saveOrUpdateAbsences(userId, [
				{
					description: trimmedDescription,
					start_time: startDate,
					end_time: endDate || null,
					status: endDate ? 'Closed' : 'Open'
				}
			]);

			if (savedAbsence) {
				dispatchAbsenceUpdated();
				await onSaved(savedAbsence);
			}

			closePopup();
		} catch (submitError) {
			console.error('Failed to save absence from home', submitError);
			error = 'Kunde inte registrera frånvaro just nu.';
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-4" on:submit|preventDefault={handleSubmit}>
	{#if error}
		<div class="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
	{/if}

	<div
		class="grid w-full grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
	>
		<div class="min-w-0">
			<Input
				bind:value={description}
				name="description"
				label="Beskrivning av frånvaro (obligatorisk)"
				placeholder="t.ex. sjuk"
				errors={validationErrors}
			/>
		</div>

		<div class="mb-4 w-full">
			<p class="text-text mb-3 block text-sm font-medium">Startdatum</p>
			<Datepicker
				bind:value={startDate}
				options={datepickerOptions}
				placeholder="Välj startdatum"
			/>
		</div>

		<div class="mb-4 flex flex-col">
			<p class="text-text mb-3 block text-sm font-medium">Slutdatum</p>
			<Datepicker
				bind:value={endDate}
				options={datepickerOptions}
				placeholder="Valfritt slutdatum"
			/>
		</div>

		<div class="w-full lg:mb-4 lg:w-auto">
			<Button text="Registrera frånvaro" type="submit" full disabled={saving || !canSave} />
		</div>
	</div>

	<p
		class={`flex items-start gap-2 text-sm ${hasInvalidDateSpan ? 'text-error' : 'text-gray-500'}`}
	>
		<Icon icon="CircleInfo" size="16px" />
		<span>
			{#if hasInvalidDateSpan}
				Slutdatum kan inte vara före startdatum.
			{:else}
				Beskrivning är obligatorisk. Lämna slutdatum tomt om frånvaron fortfarande pågår.
			{/if}
		</span>
	</p>
</form>
