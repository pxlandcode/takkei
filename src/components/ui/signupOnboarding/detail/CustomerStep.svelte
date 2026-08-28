<script lang="ts">
	import IconArrowDown from '$lib/icons/IconArrowDown.svelte';
	import { slide } from 'svelte/transition';
	import Button from '../../../bits/button/Button.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import Pill from '../../../bits/pill/Pill.svelte';
	import StepActionFooter from './StepActionFooter.svelte';
	import {
		customerDetailText,
		customerDisplayName,
		customerInfoRows,
		customerSuggestionReasons,
		displayValue,
		mergeFieldValue,
		resolutionLabel,
		sameId,
		suggestedMergeHeading,
		type SelectOption
	} from '$lib/helpers/signupOnboardingDetail';

	export let currentCase: any;
	export let payload: any = {};
	export let isOpen = false;
	export let busy = false;
	export let clientStepDone = false;
	export let selectedCustomerInfo: any = null;
	export let selectedCustomerId: number | '' = '';
	export let suggestedCustomerOptions: SelectOption[] = [];
	export let customerOptions: SelectOption[] = [];
	export let loadingCustomerOptions = false;
	export let customerOptionsError = '';
	export let customerMergePlaceholder = 'Välj kund';
	export let customerPreview: any = null;
	export let editingCustomer = false;
	export let canEditCustomer = false;
	export let canSaveCustomerChange = false;
	export let runAction: (action: any) => Promise<boolean> | boolean;
	export let selectCustomerOption: (option: SelectOption) => void;
	export let clearCustomerTarget: () => void;
	export let handleCustomerTargetChange: (event: CustomEvent<{ value: unknown }>) => void;
	export let previewCustomerMerge: () => void;
	export let startEditingCustomer: () => void;
	export let cancelEditingCustomer: () => void;
	export let retryCustomerOptions: () => void;

	let showingResolvedDetails = false;

	$: showCustomerForm =
		(currentCase.customer_resolution === 'pending' && isOpen) || editingCustomer;
	$: customerDone = currentCase.customer_resolution !== 'pending';
	$: collapsed = customerDone && !editingCustomer && !showingResolvedDetails;
	$: customerSummary = selectedCustomerInfo
		? `${customerDisplayName(selectedCustomerInfo)}${selectedCustomerInfo.id ? ` (#${selectedCustomerInfo.id})` : ''}`
		: 'Kund löst';
	$: customerMergeTargetLabel = customerPreview?.target
		? `${customerPreview.target.name} (#${customerPreview.target.id})`
		: 'målkunden';
	$: customerMergeConfirmOptions = customerPreview
		? {
				title: 'Slå ihop kunder?',
				description: `${customerPreview.source.name} (#${customerPreview.source.id}) slås ihop med ${customerMergeTargetLabel}. ${customerMergeTargetLabel} behålls.`,
				actionLabel: 'Slå ihop',
				action: () => {
					void runAction({
						type: 'merge_customer',
						targetCustomerId: Number(selectedCustomerId)
					});
				}
			}
		: null;

	async function saveCustomerChange() {
		const ok = await runAction({
			type: 'change_customer',
			targetCustomerId: Number(selectedCustomerId)
		});
		if (ok) {
			editingCustomer = false;
			showingResolvedDetails = false;
		}
	}

	function toggleCustomerDetails() {
		showingResolvedDetails = !showingResolvedDetails;
	}
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-base font-semibold text-gray-900">2. Kund</h2>
		<div class="flex shrink-0 items-center gap-2">
			<Pill variant={currentCase.customer_resolution === 'pending' ? 'danger' : 'success'}>
				{resolutionLabel(currentCase.customer_resolution)}
			</Pill>
			{#if customerDone && !editingCustomer}
				<button
					type="button"
					class="group border-gray/30 text-gray hover:bg-gray flex h-8 w-8 items-center justify-center rounded-sm border bg-white shadow-xs transition-colors duration-150 hover:text-white focus:outline-blue-500"
					aria-label={collapsed ? 'Visa kund' : 'Dölj kund'}
					aria-expanded={!collapsed}
					on:click={toggleCustomerDetails}
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
		<p class="text-sm font-semibold text-gray-900">{customerSummary}</p>
	{:else}
		<div transition:slide={{ duration: 180 }}>
			{#if selectedCustomerInfo}
				<div class="mb-3 rounded-sm border border-gray-200 bg-gray-50 p-3">
					<p class="mb-2 font-semibold text-gray-900">
						{editingCustomer
							? 'Vald kund'
							: currentCase.customer_resolution !== 'pending'
								? 'Löst kund'
								: selectedCustomerId
									? 'Vald kund'
									: 'Preliminär kund'}
					</p>
					<div class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
						{#each customerInfoRows(selectedCustomerInfo) as row}
							<div>
								<span class="text-xs text-gray-500">{row.label}</span>
								<p class="text-gray-900">{displayValue(row.value)}</p>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<p class="mb-3 text-sm text-gray-600">Ingen kund är vald.</p>
			{/if}
			{#if showCustomerForm}
				{#if clientStepDone}
					<div class="space-y-3">
						{#if suggestedCustomerOptions.length}
							<div class="rounded-sm border border-gray-200 bg-gray-50 p-3">
								<p class="mb-2 text-sm font-semibold text-gray-900">
									{suggestedMergeHeading(suggestedCustomerOptions.length)}
								</p>
								<div class="grid gap-2 sm:grid-cols-2">
									{#each suggestedCustomerOptions as option (option.value)}
										<button
											type="button"
											class={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${
												sameId(selectedCustomerId, option.value)
													? 'border-gray bg-white text-gray-900'
													: 'hover:border-gray border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
											}`}
											aria-pressed={sameId(selectedCustomerId, option.value)}
											on:click={() => selectCustomerOption(option)}
										>
											<span class="block font-semibold">{customerDisplayName(option.raw)}</span>
											<span class="mt-0.5 block text-xs text-gray-600"
												>{customerDetailText(option.raw)}</span
											>
											{#if customerSuggestionReasons(payload, option.raw).length}
												<span class="mt-2 flex flex-wrap gap-1">
													{#each customerSuggestionReasons(payload, option.raw) as reason}
														<Pill variant="warning" size="xs">{reason}</Pill>
													{/each}
												</span>
											{/if}
										</button>
									{/each}
								</div>
							</div>
						{/if}
						<Dropdown
							id="customer"
							label={editingCustomer
								? 'Byt kund'
								: currentCase.provisional_customer_id
									? 'Sök kund att slå ihop med'
									: 'Befintlig kund'}
							placeholder={editingCustomer ? 'Välj kund' : customerMergePlaceholder}
							options={customerOptions}
							bind:selectedValue={selectedCustomerId}
							disabled={loadingCustomerOptions ||
								Boolean(customerOptionsError) ||
								customerOptions.length === 0}
							search
							infiniteScroll
							on:change={handleCustomerTargetChange}
						/>
						{#if selectedCustomerId}
							<div class="flex justify-end">
								<Button
									text="Rensa val"
									iconLeft="X"
									variant="secondary"
									small
									disabled={busy}
									on:click={clearCustomerTarget}
								/>
							</div>
						{/if}
						{#if loadingCustomerOptions}
							<p class="text-sm text-gray-600">Hämtar kunder...</p>
						{:else if customerOptionsError}
							<div
								class="flex flex-col gap-2 rounded-sm border border-red-100 bg-red-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
							>
								<p class="text-red-700">{customerOptionsError}</p>
								<Button
									text="Försök igen"
									iconLeft="Refresh"
									variant="secondary"
									small
									disabled={busy}
									on:click={() => retryCustomerOptions()}
								/>
							</div>
						{:else if customerOptions.length === 0}
							<p class="text-sm text-gray-600">Inga andra kunder hittades.</p>
						{/if}
						{#if customerPreview && !editingCustomer}
							<div class="rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm">
								<p class="font-semibold text-amber-950">Merge-förhandsgranskning</p>
								<div class="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
									<div class="rounded-sm border border-amber-200 bg-white/70 p-3">
										<p class="text-xs font-semibold text-amber-800 uppercase">
											Registreringens kund som försvinner
										</p>
										<p class="mt-1 font-semibold text-gray-900">
											{customerPreview.source.name} (#{customerPreview.source.id})
										</p>
									</div>
									<div class="hidden items-center px-1 text-amber-800 sm:flex">-&gt;</div>
									<div class="rounded-sm border border-amber-300 bg-white p-3">
										<p class="text-xs font-semibold text-amber-800 uppercase">Kunden som behålls</p>
										<p class="mt-1 font-semibold text-gray-900">{customerMergeTargetLabel}</p>
									</div>
								</div>
								<div
									class="mt-3 grid gap-x-4 gap-y-2 rounded-sm border border-amber-200 bg-white p-3 sm:grid-cols-2"
								>
									{#each customerPreview.fieldPlan as field (field.key)}
										<div>
											<span class="text-xs text-gray-500">{field.label}</span>
											<p class="text-sm text-gray-900">{mergeFieldValue(field.targetValue)}</p>
										</div>
									{/each}
								</div>
							</div>
						{/if}
						<StepActionFooter>
							{#if editingCustomer}
								<Button
									text="Avbryt"
									variant="secondary"
									small
									disabled={busy}
									on:click={cancelEditingCustomer}
								/>
								<Button
									text="Spara kund"
									iconLeft="Check"
									small
									disabled={!canSaveCustomerChange || busy}
									on:click={saveCustomerChange}
								/>
							{:else if currentCase.provisional_customer_id}
								{#if customerPreview}
									<Button
										text="Behåll preliminär kund"
										variant="secondary"
										small
										disabled={busy}
										on:click={() => runAction({ type: 'keep_customer' })}
									/>
									<Button
										text={`Slå ihop och behåll ${customerMergeTargetLabel}`}
										iconLeft="Check"
										small
										disabled={busy}
										confirmOptions={customerMergeConfirmOptions}
									/>
								{:else}
									<Button
										text="Förhandsgranska merge"
										variant="secondary"
										small
										disabled={!selectedCustomerId || busy}
										on:click={previewCustomerMerge}
									/>
									<Button
										text="Behåll preliminär kund"
										small
										disabled={busy}
										on:click={() => runAction({ type: 'keep_customer' })}
									/>
								{/if}
							{:else}
								<Button
									text="Koppla"
									iconLeft="Check"
									small
									disabled={!selectedCustomerId || busy}
									on:click={() =>
										runAction({
											type: 'connect_customer',
											targetCustomerId: Number(selectedCustomerId)
										})}
								/>
							{/if}
						</StepActionFooter>
					</div>
				{:else}
					<p class="text-sm text-gray-600">Lös klienten innan kund väljs.</p>
				{/if}
			{/if}
			{#if customerDone && !editingCustomer && showingResolvedDetails && canEditCustomer}
				<StepActionFooter>
					<Button
						text="Ändra"
						iconLeft="Edit"
						variant="secondary"
						small
						on:click={startEditingCustomer}
					/>
				</StepActionFooter>
			{/if}
		</div>
	{/if}
</div>
