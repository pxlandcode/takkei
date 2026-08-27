<script lang="ts">
	import Button from '../../../bits/button/Button.svelte';
	import {
		displayValue,
		packageInfoRows,
		packageOptionLabel,
		resolutionLabel,
		sameId,
		type SelectOption
	} from '$lib/helpers/signupOnboardingDetail';

	export let currentCase: any;
	export let isOpen = false;
	export let busy = false;
	export let canResolvePackageStep = false;
	export let selectedPackageInfo: any = null;
	export let selectedPackageId: number | '' = '';
	export let suggestedPackageOptions: SelectOption[] = [];
	export let packageOptions: SelectOption[] = [];
	export let packageActionText = 'Koppla paket';
	export let canSavePackage = false;
	export let purchasedPackageRemaining = 0;
	export let loadingPackages = false;
	export let selectPackageOption: (option: SelectOption) => void;
	export let runAction: (action: any) => void;
	export let openCreatePackage: () => void;
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-base font-semibold text-gray-900">3. Paket</h2>
		<span
			class={currentCase.package_resolution === 'pending'
				? 'text-sm text-red-600'
				: 'text-sm text-green-700'}>{resolutionLabel(currentCase.package_resolution)}</span
		>
	</div>
	{#if currentCase.provisional_package_id}
		<div class="mb-3 rounded-sm border border-gray-200 bg-gray-50 p-3">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="font-semibold text-gray-900">
					{currentCase.purchased_package_name || `Paket #${currentCase.provisional_package_id}`}
				</p>
				{#if purchasedPackageRemaining <= 0}
					<span class="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700"
						>Fullbokat</span
					>
				{:else if currentCase.purchased_package_used_sessions > 0}
					<span class="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800"
						>Påbörjat</span
					>
				{/if}
			</div>
			<p class="mt-1 text-sm text-gray-600">
				{currentCase.purchased_package_used_sessions} använda/bokade · {purchasedPackageRemaining}
				kvar av {currentCase.purchased_package_total_sessions}
			</p>
			<p class="mt-1 text-xs text-gray-500">
				{currentCase.purchased_package_autogiro
					? 'Autogiro'
					: 'Faktura'}{currentCase.purchased_package_paid_price != null
					? ` · ${Number(currentCase.purchased_package_paid_price).toLocaleString('sv-SE')} kr`
					: ''}
			</p>
		</div>
	{/if}
	{#if selectedPackageInfo}
		<div class="mb-3 rounded-sm border border-gray-200 bg-gray-50 p-3">
			<p class="mb-2 font-semibold text-gray-900">Valt paket</p>
			<div class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
				{#each packageInfoRows(selectedPackageInfo) as row}
					<div>
						<span class="text-xs text-gray-500">{row.label}</span>
						<p class="text-gray-900">{displayValue(row.value)}</p>
					</div>
				{/each}
			</div>
		</div>
	{:else if currentCase.package_resolution === 'not_required'}
		<div class="mb-3 rounded-sm border border-gray-200 bg-gray-50 p-3">
			<p class="font-semibold text-gray-900">Inget paket kopplas</p>
			<p class="mt-1 text-sm text-gray-600">
				Kunden hade inget paket som kunde användas av klienten.
			</p>
		</div>
	{:else}
		<p class="mb-3 text-sm text-gray-600">Inget paket är valt.</p>
	{/if}
	{#if currentCase.package_resolution === 'pending' && isOpen}
		<div class="space-y-3">
			{#if canResolvePackageStep}
				{#if suggestedPackageOptions.length}
					<div class="rounded-sm border border-gray-200 bg-gray-50 p-3">
						<p class="mb-2 text-sm font-semibold text-gray-900">Tillgängliga paket</p>
						<div class="grid gap-2 sm:grid-cols-2">
							{#each suggestedPackageOptions as option (option.value)}
								<button
									type="button"
									class={`rounded-sm border px-3 py-2 text-left text-sm transition-colors ${
										sameId(selectedPackageId, option.value)
											? 'border-gray bg-white text-gray-900'
											: 'hover:border-gray border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
									}`}
									on:click={() => selectPackageOption(option)}
								>
									<span class="block font-semibold"
										>{option.raw?.article_name ?? option.raw?.label ?? option.label}</span
									>
									<span class="mt-0.5 block text-xs text-gray-600"
										>{packageOptionLabel(option.raw)}</span
									>
								</button>
							{/each}
						</div>
					</div>
				{/if}
				{#if loadingPackages}
					<p class="text-sm text-gray-600">Hämtar paket...</p>
				{:else if packageOptions.length > 0}
					<div class="flex flex-wrap gap-2">
						<Button
							text={packageActionText}
							variant="secondary"
							small
							disabled={!canSavePackage || busy}
							on:click={() =>
								runAction({
									type: 'connect_package',
									packageId: Number(selectedPackageId)
								})}
						/>
						<Button
							text="Lägg till paket"
							iconLeft="Plus"
							variant="secondary"
							small
							disabled={busy}
							on:click={openCreatePackage}
						/>
					</div>
				{/if}
				{#if packageOptions.length === 0 && !loadingPackages}
					<div class="flex flex-wrap items-center gap-2">
						<p class="text-sm text-gray-600">
							Den valda kunden har inga lediga paket som kan användas av klienten.
						</p>
						<Button
							text="Lägg till paket"
							iconLeft="Plus"
							variant="secondary"
							small
							disabled={busy}
							on:click={openCreatePackage}
						/>
						<Button
							text="Fortsätt utan paket"
							variant="secondary"
							small
							disabled={busy}
							on:click={() => runAction({ type: 'skip_package' })}
						/>
					</div>
				{/if}
			{:else}
				<p class="text-sm text-gray-600">Lös klient och kund innan paket väljs.</p>
			{/if}
		</div>
	{/if}
</div>
