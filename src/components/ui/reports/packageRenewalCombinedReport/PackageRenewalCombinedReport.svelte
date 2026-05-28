<script lang="ts">
	import Button from '../../../bits/button/Button.svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import OptionButton from '../../../bits/optionButton/OptionButton.svelte';
	import ClientsPackagesStatusReport from '../clientsPackagesStatusReport/ClientsPackagesStatusReport.svelte';
	import PackageRenewalReport from '../packageRenewalReport/PackageRenewalReport.svelte';

	type ReportView = 'simple' | 'detailed';
	type ReportViewOption = { value: ReportView; label: string };

	const viewOptions: ReportViewOption[] = [
		{ value: 'simple', label: 'Enkel' },
		{ value: 'detailed', label: 'Detaljerad' }
	];

	let selectedView: ReportViewOption = viewOptions[0];
	let simpleReport: { exportExcel: () => void } | null = null;
	let detailedReport: { exportExcel: () => void | Promise<void> } | null = null;

	function exportCurrentView() {
		if (selectedView.value === 'simple') {
			simpleReport?.exportExcel();
			return;
		}

		detailedReport?.exportExcel();
	}
</script>

<div class="custom-scrollbar m-4 flex h-full flex-col gap-6 overflow-y-auto pr-1">
	<div class="flex items-center justify-between gap-3">
		<div class="flex items-center gap-2">
			<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
				<Icon icon="Package" size="14px" />
			</div>
			<h2 class="text-text text-3xl font-semibold">Paketförnyelse</h2>
		</div>

		<Button
			text="Exportera"
			variant="primary"
			iconLeft="Download"
			iconColor="white"
			iconSize="12px"
			on:click={exportCurrentView}
		/>
	</div>

	<div class="max-w-xs">
		<OptionButton options={viewOptions} bind:selectedOption={selectedView} size="small" full />
	</div>

	{#if selectedView.value === 'simple'}
		<ClientsPackagesStatusReport bind:this={simpleReport} />
	{:else}
		<PackageRenewalReport
			bind:this={detailedReport}
			showHeader={false}
			showExportButton={false}
			embedded
		/>
	{/if}
</div>
