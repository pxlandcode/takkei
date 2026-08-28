<script lang="ts">
	import IconArrowDown from '$lib/icons/IconArrowDown.svelte';
	import { slide } from 'svelte/transition';
	import Button from '../../../bits/button/Button.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import Pill from '../../../bits/pill/Pill.svelte';
	import StepActionFooter from './StepActionFooter.svelte';
	import {
		displayValue,
		primaryAssignmentRows,
		resolutionLabel,
		type SelectOption
	} from '$lib/helpers/signupOnboardingDetail';

	export let currentCase: any;
	export let isOpen = false;
	export let busy = false;
	export let clientStepDone = false;
	export let trainerOptions: SelectOption[] = [];
	export let locationOptions: SelectOption[] = [];
	export let selectedPrimaryTrainerId: number | '' = '';
	export let selectedPrimaryLocationId: number | '' = '';
	export let editingPrimaryAssignment = false;
	export let canEditPrimaryAssignment = false;
	export let handlePrimaryTrainerChange: (event: CustomEvent<{ value: unknown }>) => void;
	export let savePrimaryAssignment: () => void;
	export let skipPrimaryAssignment: () => void;
	export let startEditingPrimaryAssignment: () => void;
	export let cancelEditingPrimaryAssignment: () => void;

	let showingResolvedDetails = false;

	$: showPrimaryAssignmentForm =
		(currentCase.primary_assignment_resolution === 'pending' && isOpen) || editingPrimaryAssignment;
	$: primaryAssignmentDone = currentCase.primary_assignment_resolution !== 'pending';
	$: collapsed = primaryAssignmentDone && !editingPrimaryAssignment && !showingResolvedDetails;
	$: primarySummaryRows = primaryAssignmentRows(currentCase, trainerOptions, locationOptions);
	$: primarySummary =
		currentCase.primary_assignment_resolution === 'skipped'
			? 'Ej vald'
			: [displayValue(primarySummaryRows[0]?.value), displayValue(primarySummaryRows[1]?.value)]
					.filter((value) => value !== '–')
					.join(' · ') || 'Primärval sparat';

	function togglePrimaryAssignmentDetails() {
		showingResolvedDetails = !showingResolvedDetails;
	}

	async function handleSavePrimaryAssignment() {
		await savePrimaryAssignment();
		showingResolvedDetails = false;
	}

	async function handleSkipPrimaryAssignment() {
		await skipPrimaryAssignment();
		showingResolvedDetails = false;
	}
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-base font-semibold text-gray-900">4. Primär tränare och lokal</h2>
		<div class="flex shrink-0 items-center gap-2">
			<Pill
				variant={currentCase.primary_assignment_resolution === 'pending' ? 'danger' : 'success'}
			>
				{resolutionLabel(currentCase.primary_assignment_resolution)}
			</Pill>
			{#if primaryAssignmentDone && !editingPrimaryAssignment}
				<button
					type="button"
					class="group border-gray/30 text-gray hover:bg-gray flex h-8 w-8 items-center justify-center rounded-sm border bg-white shadow-xs transition-colors duration-150 hover:text-white focus:outline-blue-500"
					aria-label={collapsed ? 'Visa primärval' : 'Dölj primärval'}
					aria-expanded={!collapsed}
					on:click={togglePrimaryAssignmentDetails}
				>
					<IconArrowDown
						size="12px"
						extraClasses={`transform transition-all duration-300 group-hover:text-white ${
							collapsed ? 'text-gray' : 'rotate-180 text-gray'
						}`}
					/>
				</button>
			{/if}
		</div>
	</div>
	{#if collapsed}
		<p class="text-sm font-semibold text-gray-900">{primarySummary}</p>
	{:else}
		<div transition:slide={{ duration: 180 }}>
			{#if currentCase.primary_assignment_resolution !== 'pending'}
				<div class="mb-3 rounded-sm border border-gray-200 bg-gray-50 p-3">
					<p class="mb-2 font-semibold text-gray-900">Primärval</p>
					<div class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
						{#each primarySummaryRows as row}
							<div>
								<span class="text-xs text-gray-500">{row.label}</span>
								<p class="text-gray-900">{displayValue(row.value)}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}
			{#if showPrimaryAssignmentForm}
				{#if clientStepDone}
					<div class="space-y-3">
						<div class="grid gap-3 sm:grid-cols-2">
							<Dropdown
								id="primary-trainer"
								label="Primär tränare"
								placeholder="Välj tränare"
								options={trainerOptions}
								bind:selectedValue={selectedPrimaryTrainerId}
								search
								infiniteScroll
								on:change={handlePrimaryTrainerChange}
							/>
							<Dropdown
								id="primary-location"
								label="Primär lokal"
								placeholder="Välj lokal"
								options={locationOptions}
								bind:selectedValue={selectedPrimaryLocationId}
								search
								infiniteScroll
							/>
						</div>
						<StepActionFooter>
							{#if editingPrimaryAssignment}
								<Button
									text="Avbryt"
									variant="secondary"
									small
									disabled={busy}
									on:click={cancelEditingPrimaryAssignment}
								/>
							{/if}
							<Button
								text="Hoppa över"
								variant="secondary"
								small
								disabled={busy}
								on:click={handleSkipPrimaryAssignment}
							/>
							<Button
								text={editingPrimaryAssignment ? 'Spara ändring' : 'Spara'}
								iconLeft="Check"
								small
								disabled={!selectedPrimaryTrainerId || !selectedPrimaryLocationId || busy}
								on:click={handleSavePrimaryAssignment}
							/>
						</StepActionFooter>
					</div>
				{:else}
					<p class="text-sm text-gray-600">Lös klienten innan primär tränare och lokal väljs.</p>
				{/if}
			{/if}
			{#if primaryAssignmentDone && !editingPrimaryAssignment && showingResolvedDetails && canEditPrimaryAssignment}
				<StepActionFooter>
					<Button
						text="Ändra"
						iconLeft="Edit"
						variant="secondary"
						small
						on:click={startEditingPrimaryAssignment}
					/>
				</StepActionFooter>
			{/if}
		</div>
	{/if}
</div>
