<script lang="ts">
	import IconArrowDown from '$lib/icons/IconArrowDown.svelte';
	import { slide } from 'svelte/transition';
	import Button from '../../../bits/button/Button.svelte';
	import Pill from '../../../bits/pill/Pill.svelte';
	import StepActionFooter from './StepActionFooter.svelte';
	import {
		displayValue,
		packageInfoRows,
		packageOptionLabel,
		resolutionLabel,
		sameId,
		type SelectOption,
		type UnavailablePackageOption
	} from '$lib/helpers/signupOnboardingDetail';

	export let currentCase: any;
	export let isOpen = false;
	export let busy = false;
	export let canResolvePackageStep = false;
	export let selectedPackageInfo: any = null;
	export let selectedPackageId: number | '' = '';
	export let suggestedPackageOptions: SelectOption[] = [];
	export let packageOptions: SelectOption[] = [];
	export let unavailablePackageOptions: UnavailablePackageOption[] = [];
	export let packageActionText = 'Koppla paket';
	export let canSavePackage = false;
	export let purchasedPackageRemaining = 0;
	export let loadingPackages = false;
	export let editingPackage = false;
	export let canEditPackage = false;
	export let selectPackageOption: (option: SelectOption) => void;
	export let runAction: (action: any) => Promise<boolean> | boolean;
	export let openCreatePackage: () => void;
	export let startEditingPackage: () => void;
	export let cancelEditingPackage: () => void;

	let showingResolvedDetails = false;

	$: showPackageForm = (currentCase.package_resolution === 'pending' && isOpen) || editingPackage;
	$: packageDone = currentCase.package_resolution !== 'pending';
	$: collapsed = packageDone && !editingPackage && !showingResolvedDetails;
	$: packageSummary =
		currentCase.package_resolution === 'not_required'
			? 'Inget paket'
			: selectedPackageInfo
				? selectedPackageInfo.article_name ||
					selectedPackageInfo.label ||
					`Paket #${selectedPackageInfo.id}`
				: 'Paket löst';

	async function savePackage() {
		const ok = await runAction({
			type: 'connect_package',
			packageId: Number(selectedPackageId)
		});
		if (ok) {
			editingPackage = false;
			showingResolvedDetails = false;
		}
	}

	async function skipPackage() {
		const ok = await runAction({ type: 'skip_package' });
		if (ok) {
			editingPackage = false;
			showingResolvedDetails = false;
		}
	}

	function togglePackageDetails() {
		showingResolvedDetails = !showingResolvedDetails;
	}
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4">
	<div class="mb-3 flex items-center justify-between gap-2">
		<h2 class="text-base font-semibold text-gray-900">3. Paket</h2>
		<div class="flex shrink-0 items-center gap-2">
			<Pill variant={currentCase.package_resolution === 'pending' ? 'danger' : 'success'}>
				{resolutionLabel(currentCase.package_resolution)}
			</Pill>
			{#if packageDone && !editingPackage}
				<button
					type="button"
					class="group border-gray/30 text-gray hover:bg-gray flex h-8 w-8 items-center justify-center rounded-sm border bg-white shadow-xs transition-colors duration-150 hover:text-white focus:outline-blue-500"
					aria-label={collapsed ? 'Visa paket' : 'Dölj paket'}
					aria-expanded={!collapsed}
					on:click={togglePackageDetails}
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
		<p class="text-sm font-semibold text-gray-900">{packageSummary}</p>
	{:else}
		<div transition:slide={{ duration: 180 }}>
			{#if currentCase.provisional_package_id}
				<div class="mb-3 rounded-sm border border-gray-200 bg-gray-50 p-3">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<p class="font-semibold text-gray-900">
							{currentCase.purchased_package_name || `Paket #${currentCase.provisional_package_id}`}
						</p>
						{#if purchasedPackageRemaining <= 0}
							<Pill variant="danger">Fullbokat</Pill>
						{:else if currentCase.purchased_package_used_sessions > 0}
							<Pill variant="warning">Påbörjat</Pill>
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
					<p class="mb-2 font-semibold text-gray-900">
						{currentCase.package_resolution !== 'pending' && !editingPackage
							? 'Löst paket'
							: 'Valt paket'}
					</p>
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
			{#if showPackageForm}
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
						{/if}
						{#if unavailablePackageOptions.length}
							<details class="rounded-sm border border-gray-200 bg-gray-50 p-3">
								<summary class="cursor-pointer text-sm font-semibold text-gray-900">
									Ej valbara paket ({unavailablePackageOptions.length})
								</summary>
								<div class="mt-3 grid gap-2 sm:grid-cols-2">
									{#each unavailablePackageOptions as option (option.value)}
										<div class="rounded-sm border border-gray-200 bg-white px-3 py-2 text-sm">
											<span class="block font-semibold text-gray-700"
												>{option.raw?.article_name ?? option.raw?.label ?? option.label}</span
											>
											<span class="mt-0.5 block text-xs text-gray-500"
												>{packageOptionLabel(option.raw)}</span
											>
											<div class="mt-2 flex flex-wrap gap-1">
												{#each option.reasons as reason}
													<Pill variant="danger" size="xs">{reason}</Pill>
												{/each}
											</div>
										</div>
									{/each}
								</div>
							</details>
						{/if}
						{#if packageOptions.length === 0 && !loadingPackages}
							<p class="text-sm text-gray-600">
								Den valda kunden har inga lediga paket som kan användas av klienten.
							</p>
						{/if}
						{#if !loadingPackages}
							<StepActionFooter>
								{#if editingPackage}
									<Button
										text="Avbryt"
										variant="secondary"
										small
										disabled={busy}
										on:click={cancelEditingPackage}
									/>
								{/if}
								<Button
									text="Lägg till paket"
									iconLeft="Plus"
									variant="secondary"
									small
									disabled={busy}
									on:click={openCreatePackage}
								/>
								{#if packageOptions.length > 0}
									<Button
										text={packageActionText}
										iconLeft="Check"
										small
										disabled={!canSavePackage || busy}
										on:click={savePackage}
									/>
								{:else}
									<Button
										text="Fortsätt utan paket"
										iconLeft="Check"
										small
										disabled={busy}
										on:click={skipPackage}
									/>
								{/if}
							</StepActionFooter>
						{/if}
					{:else}
						<p class="text-sm text-gray-600">Lös klient och kund innan paket väljs.</p>
					{/if}
				</div>
			{/if}
			{#if packageDone && !editingPackage && showingResolvedDetails && canEditPackage}
				<StepActionFooter>
					<Button
						text="Ändra"
						iconLeft="Edit"
						variant="secondary"
						small
						on:click={startEditingPackage}
					/>
				</StepActionFooter>
			{/if}
		</div>
	{/if}
</div>
