<script>
	// Route: src/routes/reports/+page.svelte
	import Icon from '../../components/bits/icon-component/Icon.svelte';
	import Navigation from '../../components/bits/navigation/Navigation.svelte';
	import Button from '../../components/bits/button/Button.svelte';
	import CustomersCreditReport from '../../components/ui/reports/customersCreditReport/CustomersCreditReport.svelte';

	const menuItems = [
		{
			label: 'Tillgodohavande',
			icon: 'Charts',
			component: CustomersCreditReport,
			requiredRoles: ['Administrator', 'Economy Admin'] // tweak as you prefer
		}
	];

	let selectedTab = menuItems[0];

	async function logout() {
		await fetch('/api/logout', { method: 'POST' });
		window.location.href = '/login';
	}
</script>

<div class="m-4 ml-3 flex flex-wrap items-center justify-between">
	<div class="flex shrink-0 items-center gap-2">
		<div class="flex h-7 w-7 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Charts" size="14px" />
		</div>
		<h2 class="text-3xl font-semibold text-text">Rapporter</h2>
	</div>

	<div class="mr-14 md:mr-0">
		<Button
			text="Logga ut"
			iconLeft="Logout"
			iconLeftSize="16"
			variant="secondary"
			small
			on:click={logout}
		/>
	</div>
</div>

<!-- Navigation with slot for content -->
<Navigation {menuItems} bind:selectedTab>
	<svelte:component this={selectedTab.component} />
</Navigation>

<style>
	/* optional route-specific styles */
</style>
