<script lang="ts">
	import Button from '../../../bits/button/Button.svelte';
	import Pill from '../../../bits/pill/Pill.svelte';
	import {
		displayValue,
		onboardingRequiredComplete,
		onboardingSummaryRows,
		type SelectOption
	} from '$lib/helpers/signupOnboardingDetail';

	export let currentCase: any;
	export let selectedClientInfo: any = null;
	export let selectedCustomerInfo: any = null;
	export let selectedPackageInfo: any = null;
	export let trainerOptions: SelectOption[] = [];
	export let locationOptions: SelectOption[] = [];
	export let busy = false;
	export let openBooking: () => void;
	export let goToClientProfile: () => void;

	$: isComplete = onboardingRequiredComplete(currentCase);
	$: rows = onboardingSummaryRows(
		currentCase,
		selectedClientInfo,
		selectedCustomerInfo,
		selectedPackageInfo,
		trainerOptions,
		locationOptions
	);
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4">
	<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
		<h2 class="text-base font-semibold text-gray-900">Sammanfattning</h2>
		<Pill variant={isComplete ? 'success' : 'danger'}>{isComplete ? 'Klar' : 'Åtgärd'}</Pill>
	</div>
	{#if isComplete}
		<div class="mb-4 rounded-sm border border-green-200 bg-green-50 p-3">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p class="font-semibold text-green-900">Registreringen är klar</p>
				<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
					<Button
						text="Gå till klientprofil"
						iconLeft="GoTo"
						variant="secondary"
						small
						disabled={busy}
						on:click={goToClientProfile}
					/>
					{#if !currentCase.booking_id}
						<Button
							text="Boka träning"
							iconLeft="Plus"
							small
							disabled={busy}
							on:click={openBooking}
						/>
					{/if}
				</div>
			</div>
		</div>
	{/if}
	<div class="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
		{#each rows as row (row.label)}
			<div>
				<span class="text-xs text-gray-500">{row.label}</span>
				<p class="font-semibold text-gray-900">{displayValue(row.value)}</p>
				{#if row.detail}
					<p class="text-xs text-gray-500">{displayValue(row.detail)}</p>
				{/if}
			</div>
		{/each}
	</div>
</div>
