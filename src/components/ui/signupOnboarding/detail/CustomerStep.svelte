<script lang="ts">
	import Button from '../../../bits/button/Button.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import {
		customerDetailText,
		customerDisplayName,
		customerInfoRows,
		displayValue,
		mergeFieldValue,
		resolutionLabel,
		sameId,
		suggestedMergeHeading,
		type SelectOption
	} from '$lib/helpers/signupOnboardingDetail';

	export let currentCase: any;
	export let isOpen = false;
	export let busy = false;
	export let clientStepDone = false;
	export let selectedCustomerInfo: any = null;
	export let selectedCustomerId: number | '' = '';
	export let suggestedCustomerOptions: SelectOption[] = [];
	export let customerOptions: SelectOption[] = [];
	export let customerMergePlaceholder = 'Välj kund';
	export let customerPreview: any = null;
	export let runAction: (action: any) => void;
	export let selectCustomerOption: (option: SelectOption) => void;
	export let handleCustomerTargetChange: (event: CustomEvent<{ value: unknown }>) => void;
	export let previewCustomerMerge: () => void;
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-base font-semibold text-gray-900">2. Kund</h2>
		<span
			class={currentCase.customer_resolution === 'pending'
				? 'text-sm text-red-600'
				: 'text-sm text-green-700'}>{resolutionLabel(currentCase.customer_resolution)}</span
		>
	</div>
	{#if selectedCustomerInfo}
		<div class="mb-3 rounded-sm border border-gray-200 bg-gray-50 p-3">
			<p class="mb-2 font-semibold text-gray-900">
				{selectedCustomerId ? 'Vald kund' : 'Preliminär kund'}
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
	{#if currentCase.customer_resolution === 'pending' && isOpen}
		{#if clientStepDone}
			<div class="space-y-3">
				{#if currentCase.provisional_customer_id}
					<Button
						text="Behåll preliminär kund"
						small
						disabled={busy}
						on:click={() => runAction({ type: 'keep_customer' })}
					/>
				{/if}
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
									on:click={() => selectCustomerOption(option)}
								>
									<span class="block font-semibold">{customerDisplayName(option.raw)}</span>
									<span class="mt-0.5 block text-xs text-gray-600"
										>{customerDetailText(option.raw)}</span
									>
								</button>
							{/each}
						</div>
					</div>
				{/if}
				<div class="grid gap-2 sm:grid-cols-[1fr_auto]">
					<Dropdown
						id="customer"
						label={currentCase.provisional_customer_id
							? 'Sök kund att slå ihop med'
							: 'Befintlig kund'}
						placeholder={customerMergePlaceholder}
						options={customerOptions}
						bind:selectedValue={selectedCustomerId}
						search
						infiniteScroll
						on:change={handleCustomerTargetChange}
					/>
					{#if currentCase.provisional_customer_id}
						<div class="self-end">
							<Button
								text="Förhandsgranska merge"
								variant="secondary"
								small
								disabled={!selectedCustomerId || busy}
								on:click={previewCustomerMerge}
							/>
						</div>
					{/if}
					{#if !currentCase.provisional_customer_id}
						<div class="self-end">
							<Button
								text="Koppla"
								variant="secondary"
								small
								disabled={!selectedCustomerId || busy}
								on:click={() =>
									runAction({
										type: 'connect_customer',
										targetCustomerId: Number(selectedCustomerId)
									})}
							/>
						</div>
					{/if}
				</div>
				{#if customerPreview}
					<div class="rounded-sm border border-amber-200 bg-amber-50 p-3 text-sm">
						<p class="font-semibold text-amber-950">
							Registreringens kund slås ihop IN I målkunden
						</p>
						<p class="mt-1 text-gray-700">
							{customerPreview.source.name} (#{customerPreview.source.id}) flyttas in i
							<span class="font-semibold"
								>{customerPreview.target.name} (#{customerPreview.target.id})</span
							>. Målkunden behålls.
						</p>
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
						<div class="mt-3">
							<Button
								text="Slå ihop kunder"
								variant="cancel"
								small
								disabled={busy}
								on:click={() =>
									runAction({
										type: 'merge_customer',
										targetCustomerId: Number(selectedCustomerId)
									})}
							/>
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<p class="text-sm text-gray-600">Lös klienten innan kund väljs.</p>
		{/if}
	{/if}
</div>
