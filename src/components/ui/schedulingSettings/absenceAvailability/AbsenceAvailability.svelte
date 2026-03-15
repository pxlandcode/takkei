<script lang="ts">
	import Button from '../../../bits/button/Button.svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import { Datepicker } from '@pixelcode_/blocks/components';

	type Absence = {
		id?: number;
		description?: string;
		start_time?: string;
		end_time?: string | null;
		status?: string;
		approved_by_id?: number;
		resetApproval?: boolean;
	};

	let {
		absences = [],
		canEdit = false,
		canApprove = false
	} = $props<{
		absences?: Absence[];
		canEdit?: boolean;
		canApprove?: boolean;
	}>();

	const dispatch = createEventDispatcher<{
		save: Absence;
		close: Absence;
		approve: Absence;
	}>();
	let description = $state('');
	let startDate = $state(getTodayDate());
	let endDate = $state('');
	let editingAbsenceId = $state<number | null>(null);
	let editingDescription = $state('');
	let editingStartDate = $state('');
	let editingEndDate = $state('');

	const datepickerOptions = {
		dateFormat: 'yyyy-MM-dd'
	} as const;

	const trimmedDescription = $derived(description.trim());
	const hasInvalidDateSpan = $derived(Boolean(startDate && endDate && endDate < startDate));
	const canSave = $derived(Boolean(trimmedDescription && startDate && !hasInvalidDateSpan));
	const trimmedEditingDescription = $derived(editingDescription.trim());
	const hasInvalidEditingDateSpan = $derived(
		Boolean(editingStartDate && editingEndDate && editingEndDate < editingStartDate)
	);
	const canSaveEdit = $derived(
		Boolean(
			editingAbsenceId &&
				trimmedEditingDescription &&
				editingStartDate &&
				!hasInvalidEditingDateSpan
		)
	);

	function getTodayDate() {
		const today = new Date();
		const year = today.getFullYear();
		const month = String(today.getMonth() + 1).padStart(2, '0');
		const day = String(today.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function resetForm() {
		description = '';
		startDate = getTodayDate();
		endDate = '';
	}

	function addAbsence() {
		if (!canSave) return;

		const absence: Absence = {
			start_time: startDate,
			end_time: endDate || null,
			status: endDate ? 'Closed' : 'Open',
			description: trimmedDescription
		};
		dispatch('save', absence);
		resetForm();
	}

	function startEditing(absence: Absence) {
		if (!absence.id) return;

		editingAbsenceId = absence.id;
		editingDescription = absence.description ?? '';
		editingStartDate = toDateInput(absence.start_time) || getTodayDate();
		editingEndDate = toDateInput(absence.end_time);
	}

	function cancelEditing() {
		editingAbsenceId = null;
		editingDescription = '';
		editingStartDate = '';
		editingEndDate = '';
	}

	function saveEditedAbsence() {
		if (!editingAbsenceId || !canSaveEdit) return;

		dispatch('save', {
			id: editingAbsenceId,
			description: trimmedEditingDescription,
			start_time: editingStartDate,
			end_time: editingEndDate || null,
			status: editingEndDate ? 'Closed' : 'Open',
			resetApproval: true
		});

		cancelEditing();
	}

	function closeAbsence(absence: Absence) {
		dispatch('close', absence);
	}

	function approveAbsence(absence: Absence) {
		dispatch('approve', absence);
	}

	function formatDateLabel(value?: string | null) {
		if (!value) return '';
		const matchedDate = toDateInput(value);
		if (matchedDate) {
			const [year, month, day] = matchedDate.split('-').map(Number);
			return new Date(year, month - 1, day).toLocaleDateString('sv-SE');
		}

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		return parsed.toLocaleDateString('sv-SE');
	}

	function toDateInput(value?: string | null) {
		if (!value) return '';
		const matchedDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
		if (matchedDate) return matchedDate;

		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return '';

		const year = parsed.getFullYear();
		const month = String(parsed.getMonth() + 1).padStart(2, '0');
		const day = String(parsed.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-md">
	<div class="mb-3 flex items-center gap-2">
		<div class="bg-text flex h-6 w-6 items-center justify-center rounded-full text-white">
			<Icon icon="Cancel" size="14px" />
		</div>
		<h3 class="text-text text-lg font-semibold">Frånvaro</h3>
	</div>

	{#if canEdit}
		<div class="mb-4 space-y-3">
			<div
				class="grid w-full grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end"
			>
				<div class="min-w-0">
					<Input
						bind:value={description}
						label="Beskrivning av frånvaro (obligatorisk)"
						placeholder="t.ex. sjuk"
						maxlength={50}
					/>
				</div>

				<div class="mb-4 w-full">
					<label class="text-text mb-3 block text-sm font-medium">Startdatum</label>
					<Datepicker
						bind:value={startDate}
						options={datepickerOptions}
						placeholder="Välj startdatum"
					/>
				</div>

				<div class="mb-4 flex flex-col">
					<label class="text-text mb-3 block text-sm font-medium">Slutdatum</label>
					<Datepicker
						bind:value={endDate}
						options={datepickerOptions}
						placeholder="Valfritt slutdatum"
					/>
				</div>

				<div class="w-full lg:mb-4 lg:w-auto">
					<Button text="Registrera frånvaro" full disabled={!canSave} on:click={addAbsence} />
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
		</div>
	{/if}

	{#if absences.length > 0}
		<ul class="space-y-3">
			{#each absences as a (`${a.id ?? a.start_time}-${a.description ?? ''}`)}
				<li
					class="flex flex-col gap-4 rounded-sm border px-4 py-3 text-sm md:flex-row md:items-start md:justify-between"
				>
					<div class="flex grow flex-col gap-3">
						{#if editingAbsenceId === a.id}
							<div class="grid gap-3 lg:grid-cols-3">
								<div class="min-w-0">
									<Input
										bind:value={editingDescription}
										label="Beskrivning av frånvaro (obligatorisk)"
										placeholder="t.ex. sjuk"
										maxlength={50}
									/>
								</div>

								<div class="mb-4 w-full">
									<label class="text-text mb-3 block text-sm font-medium">Startdatum</label>
									<Datepicker
										bind:value={editingStartDate}
										options={datepickerOptions}
										placeholder="Välj startdatum"
									/>
								</div>

								<div class="mb-4 flex flex-col">
									<label class="text-text mb-3 block text-sm font-medium">Slutdatum</label>
									<Datepicker
										bind:value={editingEndDate}
										options={datepickerOptions}
										placeholder="Valfritt slutdatum"
									/>
								</div>
							</div>

							<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
								<p
									class={`flex items-start gap-2 text-sm ${hasInvalidEditingDateSpan ? 'text-error' : 'text-gray-500'}`}
								>
									<Icon icon="CircleInfo" size="16px" />
									<span>
										{#if hasInvalidEditingDateSpan}
											Slutdatum kan inte vara före startdatum.
										{:else}
											Om du ändrar frånvaron behöver den godkännas igen.
										{/if}
									</span>
								</p>

								<div
									class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:flex-none lg:justify-end"
								>
									<Button small variant="tertiary" text="Avbryt" full on:click={cancelEditing} />
									<Button
										small
										variant="primary"
										text="Spara ändring"
										full
										disabled={!canSaveEdit}
										on:click={saveEditedAbsence}
									/>
								</div>
							</div>
						{:else}
							<div class="flex items-center gap-2">
								<strong class={a.status === 'Open' ? 'text-error' : 'text-success'}>
									{a.status === 'Open' ? 'Pågående' : 'Avslutad'}
								</strong>
								{#if a.approved_by_id}
									<Icon icon="CircleCheck" color="success" size="16px" />
								{/if}
								<span class="text-gray-700">– {a.description || 'Ingen beskrivning'}</span>
							</div>
							<div class="text-xs text-gray-500">
								Från: {formatDateLabel(a.start_time)}
								{#if a.end_time}
									– Till: {formatDateLabel(a.end_time)}
								{/if}
							</div>
						{/if}
					</div>

					{#if editingAbsenceId !== a.id && (canEdit || (canApprove && !a.approved_by_id))}
						<div
							class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end"
						>
							{#if canEdit}
								<Button
									small
									variant="tertiary"
									text="Ändra"
									full
									on:click={() => startEditing(a)}
								/>
								{#if a.status === 'Open'}
									<Button
										small
										variant="secondary"
										text="Avsluta"
										full
										on:click={() => closeAbsence(a)}
									/>
								{/if}
							{/if}
							{#if canApprove && !a.approved_by_id}
								<Button
									small
									variant="primary"
									text="Godkänn"
									full
									on:click={() => approveAbsence(a)}
								/>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-gray-400 italic">Ingen frånvaro registrerad.</p>
	{/if}
</div>
