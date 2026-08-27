<script lang="ts">
	import Button from '../../../bits/button/Button.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import {
		clientDetailText,
		clientDisplayName,
		clientInfoRows,
		clientMergeFollowupRows,
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
	export let isOpen = false;
	export let busy = false;
	export let selectedClientInfo: any = null;
	export let selectedClientId: number | '' = '';
	export let suggestedClientOptions: SelectOption[] = [];
	export let clientOptions: SelectOption[] = [];
	export let loadingClientOptions = false;
	export let clientMergePlaceholder = 'Välj målklient';
	export let clientPreview: any = null;
	export let clientInfoHeading = 'Preliminär klient';
	export let runAction: (action: any) => void;
	export let selectClientSuggestion: (option: SelectOption) => void;
	export let handleClientTargetChange: (event: CustomEvent<{ value: unknown }>) => void;
	export let previewClientMerge: () => void;
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-base font-semibold text-gray-900">1. Klient</h2>
		<span
			class={currentCase.client_resolution === 'pending'
				? 'text-sm text-red-600'
				: 'text-sm text-green-700'}>{resolutionLabel(currentCase.client_resolution)}</span
		>
	</div>
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
			<Button
				text="Bekräfta som ny klient"
				small
				disabled={busy}
				on:click={() => runAction({ type: 'confirm_new_client' })}
			/>
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
								on:click={() => selectClientSuggestion(option)}
							>
								<span class="block font-semibold">{clientDisplayName(option.raw)}</span>
								<span class="mt-0.5 block text-xs text-gray-600"
									>{clientDetailText(option.raw)}</span
								>
							</button>
						{/each}
					</div>
				</div>
			{/if}
			<div class="grid gap-2 sm:grid-cols-[1fr_auto]">
				<Dropdown
					id="merge-client"
					label="Sök klient att slå ihop med"
					placeholder={clientMergePlaceholder}
					options={clientOptions}
					bind:selectedValue={selectedClientId}
					disabled={loadingClientOptions}
					search
					infiniteScroll
					on:change={handleClientTargetChange}
				/>
				<div class="self-end">
					<Button
						text="Förhandsgranska"
						variant="secondary"
						small
						disabled={!selectedClientId || busy}
						on:click={previewClientMerge}
					/>
				</div>
			</div>
			{#if clientPreview}
				<div class="rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm">
					<p class="font-semibold text-amber-950">
						Registreringen slås ihop IN I målklienten nedan
					</p>
					<p class="mt-1 text-gray-700">
						{clientPreview.source.name} (#{clientPreview.source.id}) flyttas in i
						<span class="font-semibold"
							>{clientPreview.target.name} (#{clientPreview.target.id})</span
						>. Målklienten behålls.
					</p>
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
										<span class="text-sm font-semibold text-gray-900 sm:w-36">{field.label}</span>
										<span class="text-sm text-gray-800">{mergeFieldValue(field.keptValue)}</span>
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
					<div class="mt-3">
						<Button
							text="Slå ihop klienter"
							variant="cancel"
							small
							disabled={busy}
							on:click={() =>
								runAction({
									type: 'merge_client',
									targetClientId: Number(selectedClientId)
								})}
						/>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
