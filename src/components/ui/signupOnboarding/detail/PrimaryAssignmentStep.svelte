<script lang="ts">
	import Button from '../../../bits/button/Button.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
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
	export let handlePrimaryTrainerChange: (event: CustomEvent<{ value: unknown }>) => void;
	export let savePrimaryAssignment: () => void;
	export let skipPrimaryAssignment: () => void;
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-base font-semibold text-gray-900">4. Primär tränare och lokal</h2>
		<span
			class={currentCase.primary_assignment_resolution === 'pending'
				? 'text-sm text-red-600'
				: 'text-sm text-green-700'}
			>{resolutionLabel(currentCase.primary_assignment_resolution)}</span
		>
	</div>
	{#if currentCase.primary_assignment_resolution !== 'pending'}
		<div class="mb-3 rounded-sm border border-gray-200 bg-gray-50 p-3">
			<p class="mb-2 font-semibold text-gray-900">Primärval</p>
			<div class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
				{#each primaryAssignmentRows(currentCase, trainerOptions, locationOptions) as row}
					<div>
						<span class="text-xs text-gray-500">{row.label}</span>
						<p class="text-gray-900">{displayValue(row.value)}</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}
	{#if currentCase.primary_assignment_resolution === 'pending' && isOpen}
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
				<div class="flex flex-wrap gap-2">
					<Button
						text="Spara"
						iconLeft="Check"
						small
						disabled={!selectedPrimaryTrainerId || !selectedPrimaryLocationId || busy}
						on:click={savePrimaryAssignment}
					/>
					<Button
						text="Hoppa över"
						variant="secondary"
						small
						disabled={busy}
						on:click={skipPrimaryAssignment}
					/>
				</div>
			</div>
		{:else}
			<p class="text-sm text-gray-600">Lös klienten innan primär tränare och lokal väljs.</p>
		{/if}
	{/if}
</div>
