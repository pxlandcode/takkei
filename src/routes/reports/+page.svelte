<!-- src/routes/reports/+page.svelte -->
<script>
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import Navigation from '../../components/bits/navigation/Navigation.svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import CustomersCreditReport from '../../components/ui/reports/customersCreditReport/CustomersCreditReport.svelte';
	import ClientReport from '../../components/ui/reports/clientReport/ClientReport.svelte';
	import TargetsReport from '../../components/ui/reports/targets/TargetsReport.svelte';

	const menuItems = [
		{
			label: 'Klienter',
			icon: 'Person',
			component: ClientReport,
			requiredRoles: ['Administrator', 'Economy', 'Trainer']
		},
		{
			label: 'Tillgodo',
			icon: 'Charts',
			component: CustomersCreditReport,
			requiredRoles: ['Administrator', 'Economy']
		},
		{
			label: 'Mål',
			icon: 'Trophy',
			component: TargetsReport,
			requiredRoles: ['Administrator', 'Economy', 'Trainer', 'LocationAdmin']
		}
	];

	let selectedTab = menuItems[0];
</script>

<div class="m-4 ml-3 flex flex-wrap items-center justify-between">
	<div class="flex shrink-0 items-center gap-2">
		<div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
			<Icon icon="Charts" size="14px" />
		</div>
		<h2 class="text-text text-3xl font-semibold">Rapporter</h2>
	</div>
</div>

<Navigation {menuItems} bind:selectedTab>
	<svelte:component this={selectedTab.component} />
</Navigation>
