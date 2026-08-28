<script lang="ts">
	import IconArrowDown from '$lib/icons/IconArrowDown.svelte';
	import { slide } from 'svelte/transition';
	import Button from '../../../bits/button/Button.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import Pill from '../../../bits/pill/Pill.svelte';
	import StepActionFooter from './StepActionFooter.svelte';
	import {
		clientDetailText,
		clientDisplayName,
		clientInfoRows,
		clientMergeFollowupRows,
		clientSuggestionReasons,
		displayValue,
		mergeFieldExplanation,
		mergeFieldValue,
		mergeImpactCount,
		resolutionLabel,
		sameId,
		suggestedMergeHeading,
		type SelectOption
	} from '$lib/helpers/signupOnboardingDetail';

	export let currentCase: any;
	export let payload: any = {};
	export let isOpen = false;
	export let busy = false;
	export let selectedClientInfo: any = null;
	export let selectedClientId: number | '' = '';
	export let suggestedClientOptions: SelectOption[] = [];
	export let clientOptions: SelectOption[] = [];
	export let loadingClientOptions = false;
	export let clientOptionsError = '';
	export let clientMergePlaceholder = 'Välj målklient';
	export let clientPreview: any = null;
	export let clientInfoHeading = 'Preliminär klient';
	export let runAction: (action: any) => void;
	export let selectClientSuggestion: (option: SelectOption) => void;
	export let clearClientTarget: () => void;
	export let handleClientTargetChange: (event: CustomEvent<{ value: unknown }>) => void;
	export let previewClientMerge: () => void;
	export let retryClientOptions: () => void;

	let showingResolvedDetails = false;

	$: clientDone = currentCase.client_resolution !== 'pending';
	$: collapsed = clientDone && !showingResolvedDetails;
	$: clientSummary = selectedClientInfo
		? `${clientDisplayName(selectedClientInfo)}${selectedClientInfo.id ? ` (#${selectedClientInfo.id})` : ''}`
		: 'Klient löst';
	$: clientMergeTargetLabel = clientPreview?.target
		? `${clientPreview.target.name} (#${clientPreview.target.id})`
		: 'målklienten';
	$: clientMergeConfirmOptions = clientPreview
		? {
				title: 'Slå ihop klienter?',
				description: `${clientPreview.source.name} (#${clientPreview.source.id}) slås ihop med ${clientMergeTargetLabel}. ${clientMergeTargetLabel} behålls.`,
				actionLabel: 'Slå ihop',
				action: () => {
					void runAction({
						type: 'merge_client',
						targetClientId: Number(selectedClientId)
					});
				}
			}
		: null;

	function toggleClientDetails() {
		showingResolvedDetails = !showingResolvedDetails;
	}
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-base font-semibold text-gray-900">1. Klient</h2>
		<div class="flex shrink-0 items-center gap-2">
			<Pill variant={currentCase.client_resolution === 'pending' ? 'danger' : 'success'}>
				{resolutionLabel(currentCase.client_resolution)}
			</Pill>
			{#if clientDone}
				<button
					type="button"
					class="group border-gray/30 text-gray hover:bg-gray flex h-8 w-8 items-center justify-center rounded-sm border bg-white shadow-xs transition-colors duration-150 hover:text-white focus:outline-blue-500"
					aria-label={collapsed ? 'Visa klient' : 'Dölj klient'}
					aria-expanded={!collapsed}
					on:click={toggleClientDetails}
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
		<p class="text-sm font-semibold text-gray-900">{clientSummary}</p>
	{:else}
		<div transition:slide={{ duration: 180 }}>
			{#if selectedClientInfo}
				<div class="mb-3 rounded-sm border border-gray-200 bg-gray-50 p-3">
					<p class="mb-2 font-semibold text-gray-900">{clientInfoHeading}</p>
					<div class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
						{#each clientInfoRows(selectedClientInfo) as row}
							<div>
								<span class="text-xs text-gray-500">{row.label}</span>
								<p class="text-gray-900">{displayValue(row.value)}</p>
							</div>
						{/each}
					</div>
				</div>
			{:else}
				<p class="mb-3 text-sm text-gray-600">Ingen klient är vald.</p>
			{/if}
			{#if currentCase.client_resolution === 'pending' && isOpen}
				<div class="flex flex-col gap-3">
					{#if suggestedClientOptions.length}
						<div class="rounded-sm border border-gray-200 bg-gray-50 p-3">
							<p class="mb-2 text-sm font-semibold text-gray-900">
								{suggestedMergeHeading(suggestedClientOptions.length)}
							</p>
							<div class="grid gap-2 sm:grid-cols-2">
								{#each suggestedClientOptions as option (option.value)}
									<button
										type="button"
										class={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${
											sameId(selectedClientId, option.value)
												? 'border-gray bg-white text-gray-900'
												: 'hover:border-gray border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
										}`}
										aria-pressed={sameId(selectedClientId, option.value)}
										on:click={() => selectClientSuggestion(option)}
									>
										<span class="block font-semibold">{clientDisplayName(option.raw)}</span>
										<span class="mt-0.5 block text-xs text-gray-600"
											>{clientDetailText(option.raw)}</span
										>
										{#if clientSuggestionReasons(payload, option.raw).length}
											<span class="mt-2 flex flex-wrap gap-1">
												{#each clientSuggestionReasons(payload, option.raw) as reason}
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
						id="merge-client"
						label="Sök klient att slå ihop med"
						placeholder={clientMergePlaceholder}
						options={clientOptions}
						bind:selectedValue={selectedClientId}
						disabled={loadingClientOptions ||
							Boolean(clientOptionsError) ||
							clientOptions.length === 0}
						search
						infiniteScroll
						on:change={handleClientTargetChange}
					/>
					{#if selectedClientId}
						<div class="flex justify-end">
							<Button
								text="Rensa val"
								iconLeft="X"
								variant="secondary"
								small
								disabled={busy}
								on:click={clearClientTarget}
							/>
						</div>
					{/if}
					{#if loadingClientOptions}
						<p class="text-sm text-gray-600">Hämtar klienter...</p>
					{:else if clientOptionsError}
						<div
							class="flex flex-col gap-2 rounded-sm border border-red-100 bg-red-50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
						>
							<p class="text-red-700">{clientOptionsError}</p>
							<Button
								text="Försök igen"
								iconLeft="Refresh"
								variant="secondary"
								small
								disabled={busy}
								on:click={() => retryClientOptions()}
							/>
						</div>
					{:else if clientOptions.length === 0}
						<p class="text-sm text-gray-600">Inga andra klienter hittades.</p>
					{/if}
					{#if clientPreview}
						<div class="rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm">
							<p class="font-semibold text-amber-950">Merge-förhandsgranskning</p>
							<div class="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
								<div class="rounded-sm border border-amber-200 bg-white/70 p-3">
									<p class="text-xs font-semibold text-amber-800 uppercase">
										Registreringen/profilen som försvinner
									</p>
									<p class="mt-1 font-semibold text-gray-900">
										{clientPreview.source.name} (#{clientPreview.source.id})
									</p>
								</div>
								<div class="hidden items-center px-1 text-amber-800 sm:flex">-&gt;</div>
								<div class="rounded-sm border border-amber-300 bg-white p-3">
									<p class="text-xs font-semibold text-amber-800 uppercase">Profilen som behålls</p>
									<p class="mt-1 font-semibold text-gray-900">{clientMergeTargetLabel}</p>
								</div>
							</div>
							<div class="mt-3 rounded-sm border border-amber-200 bg-white p-3">
								<p class="mb-2 font-semibold text-gray-900">Målklient som behålls</p>
								<div class="grid gap-x-4 gap-y-2 sm:grid-cols-2">
									{#each clientPreview.fieldPlan as field (field.key)}
										<div>
											<span class="text-xs text-gray-500">{field.label}</span>
											<p class="text-sm text-gray-900">{mergeFieldValue(field.targetValue)}</p>
										</div>
									{/each}
								</div>
							</div>
							<div class="mt-3 rounded-sm border border-amber-100 bg-white/70 p-3">
								<p class="mb-2 font-semibold text-gray-900">Information efter merge</p>
								<div class="flex flex-col divide-y divide-amber-100">
									{#each clientPreview.fieldPlan as field (field.key)}
										<div class="py-2 first:pt-0 last:pb-0">
											<div class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
												<span class="text-sm font-semibold text-gray-900 sm:w-36"
													>{field.label}</span
												>
												<span class="text-sm text-gray-800">{mergeFieldValue(field.keptValue)}</span
												>
											</div>
											<p class="mt-1 text-xs text-gray-500">{mergeFieldExplanation(field)}</p>
										</div>
									{/each}
								</div>
							</div>
							<p class="mt-3 text-gray-700">
								{mergeImpactCount(clientPreview)} kopplade poster påverkas.
							</p>
							{#if clientMergeFollowupRows(currentCase).length}
								<div class="mt-3 rounded-sm border border-amber-100 bg-white/70 p-3">
									<p class="mb-2 font-semibold text-gray-900">Följer med efter merge</p>
									<div class="grid gap-x-4 gap-y-2 sm:grid-cols-2">
										{#each clientMergeFollowupRows(currentCase) as row (row.label)}
											<div>
												<span class="text-xs text-gray-500">{row.label}</span>
												<p class="text-sm font-semibold text-gray-900">{displayValue(row.value)}</p>
												<p class="text-xs text-gray-500">{displayValue(row.detail)}</p>
											</div>
										{/each}
									</div>
								</div>
							{:else}
								<p class="mt-2 text-xs text-gray-500">
									Om målklienten har en entydig kund och ett entydigt paket kopplas de automatiskt.
								</p>
							{/if}
						</div>
					{/if}
					<StepActionFooter>
						{#if clientPreview}
							<Button
								text="Bekräfta som ny klient"
								variant="secondary"
								small
								disabled={busy}
								on:click={() => runAction({ type: 'confirm_new_client' })}
							/>
							<Button
								text={`Slå ihop och behåll ${clientMergeTargetLabel}`}
								iconLeft="Check"
								small
								disabled={busy}
								confirmOptions={clientMergeConfirmOptions}
							/>
						{:else}
							<Button
								text="Förhandsgranska"
								variant="secondary"
								small
								disabled={!selectedClientId || busy}
								on:click={previewClientMerge}
							/>
							<Button
								text="Bekräfta som ny klient"
								iconLeft="Check"
								small
								disabled={busy}
								on:click={() => runAction({ type: 'confirm_new_client' })}
							/>
						{/if}
					</StepActionFooter>
				</div>
			{/if}
		</div>
	{/if}
</div>
